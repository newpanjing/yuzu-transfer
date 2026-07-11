import { QRCodeSVG } from 'qrcode.react';

type Props = { value: string };
export function QrCard({ value }: Props) { return <section className="pairing-card qr-card"><div className="qr-frame"><QRCodeSVG value={value} size={144} bgColor="#ffffff" fgColor="#161b20" level="M" includeMargin /></div><h3>扫描二维码</h3><p>使用手机相机扫描<br />自动填入验证码</p></section>; }
