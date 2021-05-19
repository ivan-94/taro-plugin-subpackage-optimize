# taro-plugin-subpackage-optimize

Taro 3.x **小程序端**分包优化

## 背景

**默认情况下，任意一个模块只要被引用两次以上都会被提取到主包中**。比如：

```shell
subPackages
  package-1    # 分包根目录
    components
      share
    pages
      foo
      bar
```

假设 `foo` 和 `bar` 都引用了 `share`，那么 `share` 默认会被提取到主包的 `common.js` 中, 尽管它只在分包中用到。

这无疑给寸土寸金的主包空间造成较大的压力。

<br/>

理想情况下，只在分包中引用到的模块应该放在分包中, 没有必要放在主包：

```shell
node_modules
  some-npm-package
src
  app.tsx
  pages
    # ...
  components
    button.tsx
  subPackages
    # ...
    package-1    # 分包根目录
      components
        share.tsx
      pages
        foo.tsx
        bar.tsx
```

如果 `some-npm-package`、`components/button.tsx`、 以及 `package-1 下的所有模块`，只在 `package-1`下的模块引用，那么这些依赖模块就应该放在 `package-1` 分包根目录下。

<br/>

`taro-plugin-subpackage-optimize` 就是做这个工作。开启 `taro-plugin-subpackage-optimize` 输出结果如下：

```
src
  app.js
  app.json
  pages
    # ...
  subPackages
    # ...
    package-1    # 分包根目录
      __subpackage_shared__.js
      pages
        foo.js
        foo.wxml
        foo.json
        bar.js
        bar.wxml
        bar.json
```

<br>

## Usage

```shell
$ yarn add taro-plugin-subpackage-optimize -D # npm i taro-plugin-subpackage-optimize  --save-dev
```

配置：

```js
// config/index.js
const config = {
  // ...
  plugins: ['taro-plugin-subpackage-optimize'],
  // ...
}
```

<br>

支持的配置项:

| 配置项      | 默认值 |                                                                          |
| ----------- | ------ | ------------------------------------------------------------------------ |
| enableInDev | false  | 是否在 development 环境开启, 默认只在 production 环境开启                |
| priority    | 20     | 分包 cacheGroup 的优先级，默认是 20，即高于 Taro 默认的 vendor 和 common |

<br>

```js
// config/index.js
const config = {
  // ...
  plugins: [
    [
      'taro-plugin-subpackage-optimize',
      {
        enableInDev: true,
      },
    ],
  ],
  // ...
}
```
