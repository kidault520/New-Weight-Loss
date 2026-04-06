/**
 * 主壳顶栏与全屏层布局（iOS/Android 刘海、底部横条、移动浏览器动态工具栏）
 *
 * - env(safe-area-inset-*)：需 index.html 中 viewport 含 viewport-fit=cover 才能在刘海机生效。
 * - 顶栏样式类：index.css 中 `.app-header-shell-fullscreen` / `.app-header-shell-inset` / `.app-header-toolbar`，全站与 AppHeader 对齐。
 * - --app-header-height：由 AppHeader 实测写入，含 safe-area 上内边距 + 工具行 + pb，与三主页一致。
 * - --app-viewport-height：见 index.css，优先 100dvh（动态视口），避免仅 100vh 时地址栏收起导致高度跳变。
 */

/** 主内容区顶距 / DragPanel 全屏层顶部锚点（与 AppHeader 实测高度一致） */
export const APP_HEADER_HEIGHT_CSS =
  'var(--app-header-height, calc(env(safe-area-inset-top) + 56px))';

/**
 * 全屏面板内容区高度：动态视口 − 顶栏（与 DragPanel 全屏模式一致）
 * 使用 var(--app-viewport-height) 以兼容不支持 dvh 的浏览器（回退 100vh）
 */
export const FULL_PANEL_HEIGHT_MINUS_HEADER_CSS = `calc(var(--app-viewport-height, 100vh) - ${APP_HEADER_HEIGHT_CSS})`;

/**
 * AI 聊天页「+」菜单（PlusMenuPopup）在 fixed 模式下：紧贴主顶栏下沿略下移，避免压住渐变栏
 * 不是独立页面，是 AppHeader 右侧加号弹出的快捷菜单。
 */
export const PLUS_MENU_TOP_CSS = `calc(${APP_HEADER_HEIGHT_CSS} + 4px)`;
