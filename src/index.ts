import { IPluginContext } from '@tarojs/service';
import { Module } from 'webpack';

import { getSubpackages, SubPackageInfo } from './utils';
import InjectSubpackageRequirePlugin from './inject-require-plugin';

/**
 * 生产共享 chunk
 * @param subPackages
 * @returns
 */
function generateCacheGroups(subPackages: SubPackageInfo[]) {
  return subPackages.reduce<{ [key: string]: any }>((prev, cur) => {
    prev[cur.name] = {
      name: cur.chunkName,
      minChunks: 2,
      // 优先级高于 common
      priority: 2,
      enforce: true,
      test(module: Module & { reasons?: Array<{ module: Module }> }) {
        // @ts-ignore
        if (module.miniType != null || module.context?.includes('node_modules')) {
          return false;
        }

        // 如果该模块完全被子包引用，那么就应该放到子包中
        if (module.reasons) {
          const set = new Set(module.reasons.map((i) => i.module));
          if (
            set.size > 1 &&
            !Array.from(set.values()).some((m) => {
              return !m.context?.startsWith(cur.path);
            })
          ) {
            // @ts-ignore
            console.log(module.resource);
            return true;
          }
        }

        return false;
      },
    };
    return prev;
  }, {});
}

export default function TaroPluginSubpackageOptimize(ctx: IPluginContext, options: { enableInDev?: boolean } = {}) {
  options = { enableInDev: false, ...options };

  // 只适用于小程序平台
  if (!['weapp', 'swan', 'alipay', 'tt', 'qq', 'jd'].includes(process.env.TARO_ENV!)) {
    return;
  }

  // 仅在 生产编译生效
  if (process.env.NODE_ENV !== 'production' && !options.enableInDev) {
    return;
  }

  // 分包共享库提取
  ctx.modifyWebpackChain(({ chain }) => {
    // 获取小程序配置

    const subPackages = getSubpackages();

    if (!subPackages.length) {
      return;
    }

    const splitChunksConfig = chain.optimization.get('splitChunks') || {};
    const cacheGroups = generateCacheGroups(subPackages);

    // 扩展 split chunk
    chain.optimization.splitChunks({
      ...splitChunksConfig,
      cacheGroups: {
        ...(splitChunksConfig.cacheGroups || {}),
        ...cacheGroups,
      },
    });

    // 用于注入 require 语句
    chain.plugin(InjectSubpackageRequirePlugin.NAME).use(InjectSubpackageRequirePlugin, [subPackages]);
  });
}
