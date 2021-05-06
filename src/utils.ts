import path from 'path';
import { Chunk } from 'webpack';
import { promoteRelativePath, readConfig, resolveMainFilePath } from '@tarojs/helper';
import { ConcatSource } from 'webpack-sources';

export interface SubPackageInfo {
  /**
   * 绝对路径
   */
  path: string;
  /**
   * 分包名称
   */
  name: string;
  /**
   * 分包上下文
   */
  context: string;
  /**
   * 分包共享 chunk 名称
   */
  chunkName: string;
}

export const SHARE_CHUNK_NAME = '__subpackage_shared__';
export const ROOT = process.cwd();

/**
 * 获取 APP 配置
 * @returns
 */
export function getAppConfig() {
  const ENTRY_PATH = path.join(ROOT, 'src/app');
  const CONFIG_PATH = resolveMainFilePath(ENTRY_PATH + '.config');

  if (CONFIG_PATH == null) {
    throw new Error('未找到入口文件：' + CONFIG_PATH);
  }

  return readConfig(CONFIG_PATH);
}

/**
 * 获取分包信息
 */
export function getSubpackages() {
  const appConfig = getAppConfig();

  const subPackageRoots: SubPackageInfo[] = [];

  if (appConfig.subPackages && appConfig.subPackages.length) {
    appConfig.subPackages.forEach((sub: { root: string; name?: string }) => {
      subPackageRoots.push({
        path: path.join(ROOT, 'src', sub.root),
        context: sub.root,
        name: sub.name || path.basename(sub.root),
        chunkName: path.posix.join(sub.root, SHARE_CHUNK_NAME),
      });
    });
  }

  return subPackageRoots;
}

/**
 * 在文本头部加入一些 require 语句
 */
export function addRequireToSource(id: string, modules: ConcatSource, commonChunk: string) {
  const source = new ConcatSource();
  source.add(`require(${JSON.stringify(promoteRelativePath(path.relative(id, commonChunk)))});\n`);
  source.add('\n');
  source.add(modules);
  source.add(';');
  return source;
}

/**
 * 获取 webpack Chunk id
 * @param chunk
 * @returns
 */
export function getIdOrName(chunk: Chunk) {
  if (typeof chunk.id === 'string') {
    return chunk.id;
  }
  return chunk.name;
}
