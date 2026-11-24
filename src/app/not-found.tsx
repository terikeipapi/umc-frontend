import Link from "next/link";

export default function NotFound() {
  return <main className="auth-page"><h1 className="auth-heading">페이지를 찾을 수 없어요.</h1><Link href="/" className="preview-link">영화 목록으로</Link></main>;
}
