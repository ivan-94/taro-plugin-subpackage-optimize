import path from 'path'
import { ConcatSource } from 'webpack-sources'
import { promoteRelativePath } from '@tarojs/helper'
import { WebpackPluginInstance, Compiler, Chunk } from 'webpack'
import { urlToRequest } from 'loader-utils'
import { SubPackageInfo, addRequireToSource, getIdOrName, SHARE_CHUNK_NAME, STYLE_EXTS } from './utils'

const PLUGIN_NAME = 'inject-subpackage-require'

export default class InjectSubpackageRequirePlugin implements WebpackPluginInstance {
  static NAME = PLUGIN_NAME
  private subPackageRoots: SubPackageInfo[]
  private styleExt = STYLE_EXTS[process.env.TARO_ENV!]

  constructor(subPackageRoots: SubPackageInfo[]) {
    this.subPackageRoots = subPackageRoots
  }

  apply(compile: Compiler) {
    compile.hooks.thisCompilation.tap(PLUGIN_NAME, (comp) => {
      // 有共享 chunk 的分包
      let subpackageHasShareChunks: SubPackageInfo[]
      comp.hooks.afterOptimizeChunks.tap(PLUGIN_NAME, (chunks: Iterable<Chunk>) => {
        const commonChunks = Array.from(chunks).filter((c) => c.name.includes(SHARE_CHUNK_NAME))
        subpackageHasShareChunks = this.subPackageRoots.filter((pkg) => {
          return commonChunks.some((c) => getIdOrName(c) === pkg.chunkName)
        })
      })

      /**
       * 给分包每个页面添加上 require
       */
      comp.chunkTemplate.hooks.renderWithEntry.tap(PLUGIN_NAME, (modules: ConcatSource, chunk: Chunk) => {
        if (subpackageHasShareChunks && subpackageHasShareChunks.length) {
          for (const pkg of subpackageHasShareChunks) {
            if (chunk.entryModule && chunk.entryModule.context?.startsWith(pkg.path)) {
              // 更新页面列表, watch 模式页面可能动态增减
              // @ts-ignore
              pkg.pages.add(path.posix.relative(pkg.context, chunk.id || chunk.entryModule.name))

              // 添加 require
              return addRequireToSource(getIdOrName(chunk), modules, pkg.chunkName)
            }
          }
        }
      })

      /**
       * 注入共享样式导入语句
       */
      comp.hooks.afterOptimizeAssets.tap(PLUGIN_NAME, (assets) => {
        for (const subpackage of subpackageHasShareChunks) {
          // 有共享的样式 chunk
          const assetName = `${subpackage.chunkName}${this.styleExt}`
          if (assets[assetName]) {
            // 需要为每个页面样式都添加 @import
            for (const page of subpackage.pages) {
              const pageScriptId = path.posix.join(subpackage.context, page + '.js')
              const pageStyleId = path.posix.join(subpackage.context, page + this.styleExt)

              if (!assets[pageScriptId]) {
                // 页面不存在
                continue
              }

              const source = new ConcatSource()
              const importStatement = `@import ${JSON.stringify(
                promoteRelativePath(path.relative(pageStyleId, assetName))
              )};`
              if (!assets[pageStyleId]) {
                // 没有添加 chunk, 手动添加
                source.add(importStatement)
              } else {
                source.add(assets[pageStyleId].source() as string)
                source.add('\n')
                source.add(importStatement)
              }

              // @ts-ignore
              assets[pageStyleId] = source
            }
          }
        }
      })
    })
  }
}
