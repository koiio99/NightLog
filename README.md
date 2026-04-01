# NightLog (睡前笔记)

NightLog 是一个伴眠语音记录与晨间AI分析的移动端应用。当你躺在床上准备入睡时，它可以帮你通过语音记录下脑海中闪过的零碎想法，并在第二天早晨通过 AI（Dify）对这些想法进行整理、分类和总结，生成一份清晰的“晨间简报”。

该项目采用混合开发架构（React + Vite + Capacitor），你可以将其作为普通的 Web 应用运行，也可以打包成原生的 Android/iOS 应用。

## ✨ 核心功能

1. **伴眠语音记录 (Sleep Mode)**
   - **语音输入**：支持在锁屏或黑屏前持续监听用户的语音输入，将睡前零碎的思绪自动转成文字。
   - **自动休眠**：设定时间（如15分钟）内没有检测到新的语音输入时，自动停止录音并退出，避免消耗整晚电量。
   - **历史记录**：自动保存所有的语音片段，并支持手动添加文本记录。

2. **晨间简报 (Morning Brief)**
   - **AI 智能整理**：对接 Dify API 的工作流，将前一晚的零散记录发送给大语言模型进行分析。
   - **结构化输出**：AI 会自动提取出你的想法，并分为“待办事项”、“灵感记录”、“情绪日记”等模块，在晨间为你清晰呈现。

3. **历史记录管理 (History)**
   - 按天查看、编辑或删除过往的睡前想法。
   - 一键生成当天的 AI 分析简报。

## 🛠 技术栈

- **前端框架**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite 8](https://vitejs.dev/)
- **样式方案**: [Tailwind CSS 4](https://tailwindcss.com/)
- **图标库**: [Lucide React](https://lucide.dev/)
- **跨平台打包**: [Capacitor 8](https://capacitorjs.com/) (支持将 Web 应用转为 Android App)
- **AI 接口**: [Dify](https://dify.ai/) API (通过工作流自动处理记录内容)

## 📂 核心目录结构

```text
nightlog/
├── android/               # Capacitor 自动生成的原生安卓项目代码
├── src/                   # 核心源代码目录
│   ├── assets/            # 静态资源 (图片、图标等)
│   ├── hooks/             # 自定义 React Hooks
│   │   └── useSpeech.ts   # 语音识别相关的核心逻辑
│   ├── pages/             # 应用页面
│   │   ├── HomePage.tsx   # 首页
│   │   ├── SleepPage.tsx  # 伴眠录音页 (核心录音与定时逻辑)
│   │   ├── HistoryPage.tsx# 历史记录页
│   │   └── BriefPage.tsx  # 晨间简报 AI 分析展示页
│   ├── services/          # 第三方服务接入
│   │   └── difyService.ts # Dify API 的调用与解析
│   ├── App.tsx            # 应用主入口与页面路由
│   ├── main.tsx           # React 挂载点
│   ├── storage.ts         # 本地数据存储逻辑
│   └── types.ts           # TypeScript 类型定义
├── .env.local             # 环境变量配置 (需要自行创建)
├── capacitor.config.ts    # Capacitor 配置文件
├── package.json           # 项目依赖与脚本
└── vite.config.ts         # Vite 构建配置
```

## 🚀 快速开始

### 1. 环境准备

确保你已经安装了以下工具：
- [Node.js](https://nodejs.org/) (建议 v18 或以上版本)
- [Android Studio](https://developer.android.com/studio) (如果你需要打包和运行 Android 版本)

### 2. 安装依赖

在项目根目录下打开终端，运行：

```bash
npm install
```

### 3. 配置环境变量

在项目根目录创建一个 `.env.local` 文件，并填入你的 Dify API 信息（用于生成晨间简报）：

```env
VITE_DIFY_API_KEY=你的dify_api_key
VITE_DIFY_BASE_URL=你的dify_api_基础地址(例如: https://api.dify.ai/v1)
```

### 4. 运行开发服务器 (Web 版)

```bash
npm run dev
```
此时你可以在浏览器中访问 `http://localhost:5173` 查看应用效果。

### 5. 编译与 Android 打包

如果你想将应用安装到手机上测试：

```bash
# 1. 构建前端代码并同步给 Capacitor 的 Android 项目
npm run android:prepare

# 2. 生成 Debug 版本的 APK (会使用 Gradle 进行编译)
npm run android:apk-debug

# 3. 生成 Release 版本的 APK
npm run android:apk-release
```
编译成功后，你可以在 `android/app/build/outputs/apk/debug/` 目录下找到生成的 `app-debug.apk` 安装包。

## 💡 使用小贴士

1. **语音识别功能**依赖于设备的语音引擎，建议在手机上运行以获得最佳的语音转文字体验。
2. **AI 解析格式**：在 Dify 的工作流中，请确保最终输出节点的内容为一段合法的 JSON，并且输出变量名设定为 `result`，格式需符合 `src/types.ts` 中的 `BriefResult` 结构。

---
*Created with ❤️ for better sleep and clear mornings.*
