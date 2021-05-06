import { IPluginContext } from '@tarojs/service'
import { Module } from 'webpack'

import { getSubpackages, SubPackageInfo, getModuleUniqId } from './utils'
import InjectSubpackageRequirePlugin from './inject-require-plugin'

/**
 * 生产共享 chunk
 * TODO: 样式支持
 * @param subPackages
 * @returns
 */
function generateCacheGroups(subPackages: SubPackageInfo[], priority: number) {
  // 缓存模块的引用情况，即是否只在子包中被引用
  const cache = new Map<string, boolean>()

  function isUnderSubpackage(subPackage: SubPackageInfo, reasons: Set<Module>) {
    for (const reason of reasons) {
      // 即不再子包下面，间接依赖也不再子包下面
      if (!reason.context?.startsWith(subPackage.path) && !cache.get(getModuleUniqId(reason))) {
        return false
      }
    }

    return true
  }

  return subPackages.reduce<{ [key: string]: any }>((prev, subPackage) => {
    prev[subPackage.name] = {
      name: subPackage.chunkName,
      minChunks: 2,
      // 默认优先级高于 common, vendor
      priority,
      enforce: true,
      // 如果该模块完全被子包引用，那么就应该放到子包中
      test(module: Module & { reasons?: Array<{ module: Module }> }) {
        // Taro 入口、页面、配置不能放到共享 chunk 中
        // @ts-ignore
        if (module.miniType != null || module.context?.includes('@tarojs') || module.type !== 'javascript/auto') {
          return false
        }

        const id = getModuleUniqId(module)
        // 重置状态
        cache.set(id, false)

        if (module.reasons) {
          // 去掉重复的 module
          const reasons = new Set(module.reasons.map((i) => i.module))

          if (reasons.size > 0 && isUnderSubpackage(subPackage, reasons)) {
            cache.set(id, true)
            return true
          }
        }

        return false
      },
    }
    return prev
  }, {})
}

export default function TaroPluginSubpackageOptimize(
  ctx: IPluginContext,
  options: { enableInDev?: boolean; priority?: number } = {}
) {
  // 默认优先级高于 vendor 和 common
  options = { enableInDev: false, priority: 20, ...options }

  // 只适用于小程序平台
  if (!['weapp', 'swan', 'alipay', 'tt', 'qq', 'jd'].includes(process.env.TARO_ENV!)) {
    return
  }

  // 仅在 生产编译生效
  if (process.env.NODE_ENV !== 'production' && !options.enableInDev) {
    return
  }

  // 分包共享库提取
  ctx.modifyWebpackChain(({ chain }) => {
    // 获取小程序配置

    const subPackages = getSubpackages()

    if (!subPackages.length) {
      return
    }

    const splitChunksConfig = chain.optimization.get('splitChunks') || {}
    const cacheGroups = generateCacheGroups(subPackages, options.priority!)

    // 扩展 split chunk
    chain.optimization.splitChunks({
      ...splitChunksConfig,
      cacheGroups: {
        ...(splitChunksConfig.cacheGroups || {}),
        ...cacheGroups,
      },
    })

    // 用于注入 require 语句
    chain.plugin(InjectSubpackageRequirePlugin.NAME).use(InjectSubpackageRequirePlugin, [subPackages])
  })
}
