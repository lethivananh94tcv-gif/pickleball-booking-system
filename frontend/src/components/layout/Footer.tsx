"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaFacebookF, FaInstagram, FaYoutube, FaTiktok } from "react-icons/fa";
import styles from "./Footer.module.css";

export default function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.topLine}></div>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo}>Pickle<span>Club</span></Link>
          <p>Nền tảng đặt sân Pickleball và kết nối Coach & người chơi hàng đầu tại Việt Nam.</p>
          <div className={styles.socials}>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <FaFacebookF />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <FaInstagram />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <FaYoutube />
            </a>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
              <FaTiktok />
            </a>
          </div>
        </div>

        <div>
          <h4>Liên kết nhanh</h4>
          <Link href="/">Trang chủ</Link>
          <Link href="/courts">Sân</Link>
          <Link href="/coaches">Coach</Link>
          <Link href="/combo">Combo</Link>
          <Link href="/matching">Tìm người chơi</Link>
        </div>

        <div>
          <h4>Liên hệ</h4>
          <p>☎ 1900 1234</p>
          <p>✉ support@pickleclub.vn</p>
          <p>⌖ Đà Nẵng, Việt Nam</p>
        </div>
      </div>
    </footer>
  );
}
