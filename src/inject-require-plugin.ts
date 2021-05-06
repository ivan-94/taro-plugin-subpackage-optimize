import { ConcatSource } from 'webpack-sources';
import { WebpackPluginInstance, Compiler, Chunk } from 'webpack';
import { SubPackageInfo, addRequireToSource, getIdOrName, SHARE_CHUNK_NAME } from './utils';

const PLUGIN_NAME = 'inject-subpackage-require';

export default class InjectSubpackageRequirePlugin implements WebpackPluginInstance {
  static NAME = PLUGIN_NAME;
  private subPackageRoots: SubPackageInfo[];
  constructor(subPackageRoots: SubPackageInfo[]) {
    this.subPackageRoots = subPackageRoots;
  }

  apply(compile: Compiler) {
    compile.hooks.thisCompilation.tap(PLUGIN_NAME, (comp) => {
      // 有共享 chunk 的分包
      let subpackageHasShareChunks: SubPackageInfo[];
      comp.hooks.afterOptimizeChunks.tap(PLUGIN_NAME, (chunks: Iterable<Chunk>) => {
        const commonChunks = Array.from(chunks).filter((c) => c.name.includes(SHARE_CHUNK_NAME));
        subpackageHasShareChunks = this.subPackageRoots.filter((pkg) => {
          return commonChunks.some((c) => getIdOrName(c) === pkg.chunkName);
        });
      });

      // 给分包每个页面添加上 require
      comp.chunkTemplate.hooks.renderWithEntry.tap(PLUGIN_NAME, (modules: ConcatSource, chunk: Chunk) => {
        if (subpackageHasShareChunks && subpackageHasShareChunks.length) {
          for (const pkg of subpackageHasShareChunks) {
            if (chunk.entryModule && chunk.entryModule.context?.startsWith(pkg.path)) {
              // 添加 require
              return addRequireToSource(getIdOrName(chunk), modules, pkg.chunkName);
            }
          }
        }
      });
    });
  }
}
