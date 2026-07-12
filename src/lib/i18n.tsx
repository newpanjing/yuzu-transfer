import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../constants';

export const LANGUAGE_OPTIONS = ['system', 'zh-CN', 'en-US'] as const;
export type LanguagePreference = typeof LANGUAGE_OPTIONS[number];
export type ResolvedLanguage = Exclude<LanguagePreference, 'system'>;

type TranslationValue = string;
type TranslationDictionary = Record<string, TranslationValue>;

const translations: Record<ResolvedLanguage, TranslationDictionary> = {
  'zh-CN': {
    'language.option.system': '跟随系统',
    'language.option.zh-CN': '中文',
    'language.option.en-US': 'English',
    'brand.appName': '柚子快传',
    'brand.mode': '无痕模式',
    'header.meta': '不登录 · 不存文件 · 不留记录',
    'header.languageLabel': '语言',
    'footer.ready': '当前设备已就绪',
    'footer.private': '无痕模式已开启',
    'nav.connect': '连接新设备',
    'nav.conversations': '会话',
    'nav.back': '返回',
    'nav.noConversations': '暂无会话',
    'nav.settings': '设置',
    'nav.about': '关于',
    'sidebar.empty': '连接设备后，会话会显示在这里',
    'sidebar.preview.blocked': '该会话已屏蔽',
    'sidebar.preview.connected': '已建立连接',
    'connect.privacyTitle': '无痕传输',
    'connect.privacyBody': '文件优先在设备间直连，不保存至服务器',
    'connect.eyebrow': '安全直连',
    'connect.title': '连接新设备',
    'connect.subtitle': '在手机上打开柚子快传，扫描二维码或输入验证码连接',
    'connect.myCode.title': '我的验证码',
    'connect.myCode.subtitle': '在另一台设备上输入此四位数',
    'connect.copy': '复制邀请链接',
    'connect.copied': '已复制',
    'connect.refresh': '刷新',
    'connect.qr.title': '扫描二维码',
    'connect.qr.subtitle': '使用手机相机扫描，自动开始连接',
    'connect.qr.alt': '连接二维码',
    'connect.qr.tip': '手机端可长按二维码另存为',
    'connect.join.title': '输入验证码',
    'connect.join.subtitle': '输入另一台设备的四位验证码',
    'connect.join.busy': '正在连接...',
    'connect.join.action': '加入设备',
    'connect.codeAria': '我的验证码 {code}',
    'connect.digitAria': '验证码第 {index} 位',
    'settings.title': '设置',
    'settings.subtitle': '当前会话仅在本次浏览器 Session 内生效。',
    'settings.nickname': '我的昵称',
    'settings.nicknamePlaceholder': '请输入昵称',
    'settings.avatar': '我的头像',
    'settings.language': '语言',
    'settings.save': '保存',
    'settings.saved': '已自动保存到当前会话',
    'about.title': '关于',
    'about.subtitle': '柚子快传是一个基于 WebRTC 的局域网优先直连传输工具。',
    'about.website': '官网',
    'about.github': 'GitHub',
    'dialog.error.title': '无法连接设备',
    'dialog.error.close': '关闭提示',
    'dialog.error.confirm': '我知道了',
    'dialog.file.close': '稍后保存',
    'dialog.file.title': '文件接收完成',
    'dialog.file.action': '选择保存位置',
    'dialog.preview.zoomOut': '缩小',
    'dialog.preview.zoomIn': '放大',
    'dialog.preview.close': '关闭预览',
    'conversation.actions': '会话操作',
    'conversation.rename': '改名',
    'conversation.block': '屏蔽会话',
    'conversation.unblock': '解除屏蔽',
    'conversation.delete': '删除会话',
    'conversation.renamePrompt': '设置会话名称',
    'conversation.defaultPeer': '新设备',
    'workspace.sessionNotice': '会话数据仅当前页面有效，关闭页面后将丢失。',
    'workspace.today': '今天',
    'workspace.empty.blockedTitle': '该会话已屏蔽',
    'workspace.empty.connectedTitle': '已建立安全连接',
    'workspace.empty.offlineTitle': '对方当前不在线',
    'workspace.empty.blockedBody': '解除屏蔽后才能继续连接和发送',
    'workspace.empty.connectedBody': '拖入文件、图片或发送消息',
    'workspace.empty.offlineBody': '对方上线后即可发送消息和文件',
    'workspace.fileExpired': '已过期，无法下载',
    'workspace.imageExpired': '已过期，无法预览',
    'workspace.completed': '已完成',
    'workspace.remaining': '剩余 {time}',
    'workspace.download': '下载',
    'workspace.pickFile': '选择文件',
    'workspace.input.blocked': '该会话已屏蔽',
    'workspace.input.connected': '输入消息或拖拽文件到此处',
    'workspace.input.offline': '对方不在线，输入消息后将提示',
    'workspace.send': '发送',
    'duration.seconds': '{value} 秒',
    'duration.minutes': '{minutes} 分 {seconds} 秒',
    'error.presence': '在线状态刷新失败，请确认服务是否可用。',
    'error.pairing': '验证码不正确、已过期，或该设备当前不可连接。请确认后重试。',
    'error.signalingRequired': '直连服务尚未就绪，请稍后重试。',
    'error.blockedJoin': '该设备会话已被屏蔽，解除屏蔽后才能连接。',
    'error.connect': '当前无法连接该设备，请稍后重试。',
    'error.server': '配对服务暂不可用，请确认 Go 服务已启动。',
    'error.incomingJoin': '有设备已通过验证码加入。',
    'error.offlineNotice': '对方不在线，暂时无法发送消息或文件。',
    'error.blockedNotice': '该会话已屏蔽，解除屏蔽后才能发送或连接。',
    'error.fileSend': '文件发送失败，请检查设备连接。',
    'error.relayLimit': '中转文件不可超过 {limit}',
    'peer.signaling': '信令连接失败，请检查服务是否可用。',
    'peer.dataChannel': '数据通道尚未连接',
    'invitation.prefix': '邀请您使用柚子快传：',
    'avatar.yuzu-classic': '经典柚子',
    'avatar.yuzu-leaf': '嫩叶柚子',
    'avatar.yuzu-blush': '脸红柚子',
    'avatar.yuzu-cool': '墨镜柚子',
    'avatar.yuzu-spark': '星光柚子',
    'avatar.yuzu-night': '夜色柚子',
  },
  'en-US': {
    'language.option.system': 'Follow System',
    'language.option.zh-CN': '中文',
    'language.option.en-US': 'English',
    'brand.appName': 'Yuzu Transfer',
    'brand.mode': 'Private Mode',
    'header.meta': 'No login · No file storage · No history',
    'header.languageLabel': 'Language',
    'footer.ready': 'This device is ready',
    'footer.private': 'Private mode enabled',
    'nav.connect': 'Connect',
    'nav.conversations': 'Chats',
    'nav.back': 'Back',
    'nav.noConversations': 'No Chats',
    'nav.settings': 'Settings',
    'nav.about': 'About',
    'sidebar.empty': 'Chats will appear here after you connect a device',
    'sidebar.preview.blocked': 'This chat is blocked',
    'sidebar.preview.connected': 'Connection established',
    'connect.privacyTitle': 'Private Transfer',
    'connect.privacyBody': 'Files are sent directly between devices first and are not stored on the server',
    'connect.eyebrow': 'Secure Direct Link',
    'connect.title': 'Connect a New Device',
    'connect.subtitle': 'Open Yuzu Transfer on your phone, then scan the QR code or enter the code to connect',
    'connect.myCode.title': 'My Code',
    'connect.myCode.subtitle': 'Enter this 4-digit code on another device',
    'connect.copy': 'Copy Invite Link',
    'connect.copied': 'Copied',
    'connect.refresh': 'Refresh',
    'connect.qr.title': 'Scan QR Code',
    'connect.qr.subtitle': 'Scan with your phone camera to connect automatically',
    'connect.qr.alt': 'Connection QR code',
    'connect.qr.tip': 'On mobile, long-press the QR code to save it',
    'connect.join.title': 'Enter Code',
    'connect.join.subtitle': 'Enter the 4-digit code from another device',
    'connect.join.busy': 'Connecting...',
    'connect.join.action': 'Join Device',
    'connect.codeAria': 'My pairing code {code}',
    'connect.digitAria': 'Pairing code digit {index}',
    'settings.title': 'Settings',
    'settings.subtitle': 'Current chats are available only in this browser session.',
    'settings.nickname': 'My Nickname',
    'settings.nicknamePlaceholder': 'Enter a nickname',
    'settings.avatar': 'My Avatar',
    'settings.language': 'Language',
    'settings.save': 'Save',
    'settings.saved': 'Automatically saved to the current session',
    'about.title': 'About',
    'about.subtitle': 'Yuzu Transfer is a WebRTC-based transfer tool optimized for direct local-network connections.',
    'about.website': 'Website',
    'about.github': 'GitHub',
    'dialog.error.title': 'Unable to Connect',
    'dialog.error.close': 'Close dialog',
    'dialog.error.confirm': 'Got it',
    'dialog.file.close': 'Save later',
    'dialog.file.title': 'File Received',
    'dialog.file.action': 'Choose Save Location',
    'dialog.preview.zoomOut': 'Zoom out',
    'dialog.preview.zoomIn': 'Zoom in',
    'dialog.preview.close': 'Close preview',
    'conversation.actions': 'Chat actions',
    'conversation.rename': 'Rename',
    'conversation.block': 'Block Chat',
    'conversation.unblock': 'Unblock',
    'conversation.delete': 'Delete Chat',
    'conversation.renamePrompt': 'Set chat name',
    'conversation.defaultPeer': 'New Device',
    'workspace.sessionNotice': 'Chat data only exists on this page and will be lost after the page is closed.',
    'workspace.today': 'Today',
    'workspace.empty.blockedTitle': 'This chat is blocked',
    'workspace.empty.connectedTitle': 'Secure connection established',
    'workspace.empty.offlineTitle': 'The other device is offline',
    'workspace.empty.blockedBody': 'Unblock this chat to continue sending and connecting',
    'workspace.empty.connectedBody': 'Drop files, images, or send a message',
    'workspace.empty.offlineBody': 'Messages and files can be sent once the other device is online',
    'workspace.fileExpired': 'Expired and unavailable for download',
    'workspace.imageExpired': 'Expired and unavailable for preview',
    'workspace.completed': 'Completed',
    'workspace.remaining': '{time} left',
    'workspace.download': 'Download',
    'workspace.pickFile': 'Choose file',
    'workspace.input.blocked': 'This chat is blocked',
    'workspace.input.connected': 'Type a message or drop files here',
    'workspace.input.offline': 'The other device is offline. Sending will show a notice',
    'workspace.send': 'Send',
    'duration.seconds': '{value}s',
    'duration.minutes': '{minutes}m {seconds}s',
    'error.presence': 'Failed to refresh online status. Check whether the service is available.',
    'error.pairing': 'The code is invalid, expired, or the device is unavailable. Please verify and try again.',
    'error.signalingRequired': 'Direct signaling is not ready yet. Please try again later.',
    'error.blockedJoin': 'This chat is blocked. Unblock it before connecting.',
    'error.connect': 'Unable to connect to this device right now. Please try again later.',
    'error.server': 'Pairing service is unavailable. Make sure the Go service is running.',
    'error.incomingJoin': 'A device joined using your pairing code.',
    'error.offlineNotice': 'The other device is offline, so messages and files cannot be sent right now.',
    'error.blockedNotice': 'This chat is blocked. Unblock it before sending or connecting.',
    'error.fileSend': 'File transfer failed. Please check the device connection.',
    'error.relayLimit': 'Relay transfer files cannot exceed {limit}',
    'peer.signaling': 'Signaling connection failed. Check whether the service is available.',
    'peer.dataChannel': 'Data channel is not connected yet',
    'invitation.prefix': 'You are invited to use Yuzu Transfer: ',
    'avatar.yuzu-classic': 'Classic Yuzu',
    'avatar.yuzu-leaf': 'Leaf Yuzu',
    'avatar.yuzu-blush': 'Blush Yuzu',
    'avatar.yuzu-cool': 'Cool Yuzu',
    'avatar.yuzu-spark': 'Spark Yuzu',
    'avatar.yuzu-night': 'Night Yuzu',
  },
};

type TranslationKey = keyof typeof translations['zh-CN'];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

type I18nContextValue = {
  language: LanguagePreference;
  resolvedLanguage: ResolvedLanguage;
  setLanguage: (value: LanguagePreference) => void;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function detectSystemLanguage(): ResolvedLanguage {
  if (typeof navigator === 'undefined') return 'zh-CN';
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function resolveLanguage(language: LanguagePreference): ResolvedLanguage {
  return language === 'system' ? detectSystemLanguage() : language;
}

export function getStoredLanguagePreference(): LanguagePreference {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEYS.language);
  return LANGUAGE_OPTIONS.includes(stored as LanguagePreference) ? stored as LanguagePreference : 'system';
}

function interpolate(template: string, variables?: Record<string, string | number>) {
  if (!variables) return template;
  return Object.entries(variables).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

export function translateForLanguage(language: ResolvedLanguage, key: TranslationKey, variables?: Record<string, string | number>) {
  return interpolate(translations[language][key], variables);
}

export function translateNow(key: TranslationKey, variables?: Record<string, string | number>) {
  return translateForLanguage(resolveLanguage(getStoredLanguagePreference()), key, variables);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguagePreference>(getStoredLanguagePreference);
  const [resolvedLanguage, setResolvedLanguage] = useState<ResolvedLanguage>(resolveLanguage(language));

  useEffect(() => {
    const nextResolved = resolveLanguage(language);
    setResolvedLanguage(nextResolved);
    localStorage.setItem(STORAGE_KEYS.language, language);
  }, [language]);

  useEffect(() => {
    if (language !== 'system') return;
    const handleChange = () => setResolvedLanguage(detectSystemLanguage());
    window.addEventListener('languagechange', handleChange);
    return () => window.removeEventListener('languagechange', handleChange);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    resolvedLanguage,
    setLanguage: setLanguageState,
    t: (key, variables) => translateForLanguage(resolvedLanguage, key, variables),
  }), [language, resolvedLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('I18nProvider is missing');
  return context;
}
