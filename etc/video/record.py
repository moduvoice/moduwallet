# moduwallet 데모 녹화: 배포 주소를 390x844 로 자동 조작하며 녹화하고, 장면 시작 시각을 marks.json 에 남긴다.
import json, re, sys, time
from pathlib import Path

sys.path.insert(0, r"C:\Users\admin\.claude\skills\playwright")
from browser import open_browser

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://agreeable-grass-01185c300.3.azurestaticapps.net"
OUT = Path(r"D:\project\hacka\truemarkets\tmp\video")
RAW = OUT / "raw"
RAW.mkdir(parents=True, exist_ok=True)
DUR = json.load(open(OUT / "vo" / "durations.json"))
marks = {}
T0 = None


def tab(page, name):
    for _ in range(3):
        nav = page.get_by_role("navigation").get_by_text(name, exact=True)
        if nav.count() and nav.last.is_visible():
            nav.last.click()
            return
        page.go_back()
        page.wait_for_timeout(1200)
    raise RuntimeError("tab not found: " + name)


def btn(page, name, exact=False):
    return page.get_by_role("button", name=re.compile(name) if not exact else name, exact=exact)


with open_browser(headless=True, record_video_dir=str(RAW), record_video_size={"width": 390, "height": 844}) as (ctx, page):
    page.set_viewport_size({"width": 390, "height": 844})
    # 준비: 영어, 빈 지갑(녹화 전 화면은 잘라낸다)
    page.goto(BASE + "/")
    page.evaluate("localStorage.clear(); localStorage.setItem('moduwallet.lang.v1','en')")
    page.goto(BASE + "/")
    page.wait_for_timeout(4000)
    T0 = time.monotonic()
    marks["_start"] = 0.0

    def scene(name, extra=0.6):
        """장면 시작을 기록하고, 끝낼 때 내레이션 길이만큼 지났는지 맞춰 기다리는 함수를 돌려준다"""
        t = time.monotonic()
        marks[name] = t - T0
        def end(more=0.0):
            left = DUR[name] + extra + more - (time.monotonic() - t)
            if left > 0:
                page.wait_for_timeout(int(left * 1000))
        return end

    def keypad(digits):
        for d in digits:
            page.get_by_role("button", name=d, exact=True).last.click()
            page.wait_for_timeout(250)

    def shot(n):
        page.screenshot(path=str(OUT / f"step_{n}.png"))

    try:
        end = scene("01_intro"); end()
        end = scene("02_home")
        page.mouse.wheel(0, 350); page.wait_for_timeout(1500); page.mouse.wheel(0, -350); end()

        end = scene("03_search")
        tab(page, "Stocks"); page.wait_for_timeout(1500)
        box = page.get_by_role("searchbox").first if page.get_by_role("searchbox").count() else page.get_by_placeholder(re.compile("Search"))
        box.click(); page.keyboard.type("nvid", delay=180); page.wait_for_timeout(1500)
        box.fill(""); page.wait_for_timeout(800)
        page.mouse.wheel(0, 500); page.wait_for_timeout(1500); page.mouse.wheel(0, -500)
        end()

        end = scene("04_detail")
        page.get_by_text("NVIDIA", exact=True).first.click(); page.wait_for_timeout(2000)
        try:
            btn(page, "^1W$").first.click(timeout=3000); page.wait_for_timeout(1000)
        except Exception:
            pass
        end()

        end = scene("05_buy")
        btn(page, "^Buy").last.click(); page.wait_for_timeout(900)
        keypad("50"); page.wait_for_timeout(1200)
        try:
            btn(page, "^Shares$").first.click(); page.wait_for_timeout(1500)
            btn(page, "^USD$").first.click(); page.wait_for_timeout(1000)
            keypad("50") if page.get_by_text("$0").count() else None
        except Exception:
            pass
        end()

        end = scene("06_quote")
        btn(page, "^Next$").last.click(); page.wait_for_timeout(2500); shot("06"); end()

        end = scene("07_done")
        btn(page, "^Buy").last.click(); page.wait_for_timeout(1800); end()
        btn(page, "^OK$").last.click(); page.wait_for_timeout(600)

        end = scene("08_lev")
        tab(page, "Leverage"); page.wait_for_timeout(2500)
        try:
            btn(page, "What's this").first.click(); page.wait_for_timeout(2500)
            btn(page, "^Got it$").last.click()
        except Exception:
            pass
        end()

        end = scene("09_dir")
        page.get_by_text("NVIDIA", exact=True).first.click(); page.wait_for_timeout(1800)
        btn(page, "It'll go up").first.click(); page.wait_for_timeout(800); end()

        end = scene("10_mult")
        try:
            btn(page, "^5x$").first.click()
        except Exception:
            pass
        page.wait_for_timeout(1500); shot("10"); end()

        end = scene("11_open")
        btn(page, "^Go with").last.click(); page.wait_for_timeout(900)
        keypad("100"); page.wait_for_timeout(800)
        btn(page, "^Next$").last.click(); page.wait_for_timeout(2500)
        page.get_by_text("I understand I can lose everything").first.click(); page.wait_for_timeout(500)
        btn(page, "^Start at").last.click(); page.wait_for_timeout(1500); shot("11")
        end()

        end = scene("12_pos")
        btn(page, "^OK$").last.click(); page.wait_for_timeout(2500)
        btn(page, "^Close trade$").first.click(); page.wait_for_timeout(2500); shot("12")
        btn(page, "^Close").last.click(); page.wait_for_timeout(1500)
        end()
        try:
            btn(page, "^(OK|Done|Close)$").last.click(timeout=2500); page.wait_for_timeout(500)
        except Exception:
            page.keyboard.press("Escape")

        end = scene("13_hist")
        tab(page, "Activity"); page.wait_for_timeout(1500); end()

        end = scene("14_lang")
        for lang in ["한국어", "Tiếng Việt", "ไทย"]:
            btn(page, "Change language|언어 바꾸기|Сменить язык|เปลี่ยนภาษา|Đổi ngôn ngữ|切换语言").first.click(); page.wait_for_timeout(700)
            page.get_by_text(lang, exact=True).first.click(); page.wait_for_timeout(1500)
        btn(page, "Change language|언어 바꾸기|Сменить язык|เปลี่ยนภาษา|Đổi ngôn ngữ|切换语言").first.click(); page.wait_for_timeout(500)
        page.get_by_text("English", exact=True).first.click(); page.wait_for_timeout(800)
        tab(page, "Home")
        end()

        end = scene("15_outro"); end(1.5)
    except Exception as e:
        print("FAILED at", list(marks)[-1], repr(e)[:300])
        page.screenshot(path=str(OUT / "fail.png"))
    marks["_end"] = time.monotonic() - T0
    video = page.video.path() if page.video else None

json.dump({"marks": marks, "video": str(video)}, open(OUT / "marks.json", "w"), indent=1)
print(json.dumps(marks, indent=1), video)
