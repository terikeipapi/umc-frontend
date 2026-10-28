export default function Footer() {
  return (
    <footer className="border-t border-[#eee] bg-[#fafafa] px-6 py-8 text-[#777]">
      <div className="mx-auto flex w-[1200px] max-w-full items-center gap-6">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" aria-label="영화 데이터 출처: TMDB (새 창)">
          <img
            className="block h-auto w-20"
            src="/images/tmdb-logo.svg"
            alt="TMDB"
            width="80"
            height="10.4"
          />
        </a>
        <div className="text-xs leading-5">
          <p>영화 정보 및 이미지 제공: TMDB</p>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </div>
      </div>
    </footer>
  );
}
