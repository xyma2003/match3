# 奶龙消消乐

支持自定义游戏名称和棋子图片的八行八列三消游戏。

## 功能

- 三连消除、四连横向/纵向特效、L/T 型交叉特效和五连 Boss
- 连消、下落动画、死局自动洗牌
- 无限关卡，每五关为困难关
- 游客本地进度
- 用户名密码登录、多游戏和云端关卡记录
- 手机触控、滑动交换和响应式布局

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

## 云端数据

登录账号、游戏进度和用户上传的图片均保存到 EdgeOne Pages Blob；游客进度仍保存在当前浏览器中。
实际账号、密码哈希、游戏进度和上传图片不会保存在 Git 仓库中。

## 部署

当前线上版本部署在腾讯云 EdgeOne Pages（Makers），代码来源为
[`xyma2003/match3`](https://github.com/xyma2003/match3) 的 `main` 分支。

### EdgeOne Pages 部署步骤

1. 在 EdgeOne Pages（Makers）中选择“导入 Git 仓库”。
2. 连接 GitHub，并选择 `xyma2003/match3`。
3. 将生产分支设为 `main`，项目根目录保持为仓库根目录。
4. 使用 `npm install` 安装依赖，并用 `npm run build` 执行正式构建。
5. 部署完成后，在部署记录中生成预览链接进行验证。

项目通过 [`edgeone.json`](edgeone.json) 固定使用 Node.js 22.17.1。部署时不需要额外配置数据库连接；
登录账号、游戏进度和用户上传图片会在首次写入时保存到名为 `nailong-match3` 的 EdgeOne Pages Blob 存储中。

EdgeOne 生成的默认预览链接有有效期，只适合临时测试。长期分享需要在项目的“域名管理”中绑定已完成相应配置的自定义域名，
例如 `game.goafield.cn`。绑定域名不会改变 GitHub 仓库或构建流程。

每次部署前建议在本地运行：

```bash
npm run lint
npm run build
```
