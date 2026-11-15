import json, subprocess
O = "tmp/video/"
m = json.load(open(O + "marks.json")); marks = m["marks"]; video = m["video"]
D = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], capture_output=True, text=True).stdout)
off = max(0.0, D - marks["_end"] - 0.4)
end = marks["_end"]
caps = {
 "01_intro": ("moduwallet", "Easy U.S. stocks, in a clean wallet"),
 "02_home": ("One calm home", "Balance, today's change, holdings"),
 "03_search": ("90+ stocks & ETFs", "Tokenized U.S. stocks, plus BTC & ETH"),
 "04_detail": ("Live market data", "Prices & charts from True Markets"),
 "05_buy": ("Buy in dollars or shares", "One sheet, one keypad"),
 "06_quote": ("Real-time quotes", "True Markets quotes, fee & spread explained"),
 "07_done": ("Done in a tap", "Simulated fill in demo mode"),
 "08_lev": ("Leverage, made simple", "A few plain questions"),
 "09_dir": ("Up or down?", "Long and short, in plain words"),
 "10_mult": ("What 5x really means", "+1% → +5%, and where you lose it all"),
 "11_open": ("Scenario table + risk check", "Then your position is open"),
 "12_pos": ("P&L at a glance", "Distance to liquidation, close in one tap"),
 "13_hist": ("Activity", "Realized P&L and fees"),
 "14_lang": ("6 languages", "EN · KO · ZH · TH · VI · RU"),
 "15_outro": ("Easy stocks, for everyone.", "moduwallet · built on True Markets Gateway"),
}
names = [k for k in marks if not k.startswith("_")]
F1 = "C\:/Windows/Fonts/segoeuib.ttf"
F2 = "C\:/Windows/Fonts/segoeui.ttf"

def tf(name, text):
    p = f"{O}cap/{name}.txt"
    open(p, "w", encoding="utf-8").write(text)
    return p.replace(":", "\:")

draw = []
for i, k in enumerate(names):
    a = marks[k]; b = marks[names[i + 1]] if i + 1 < len(names) else end + 0.5
    t1, t2 = caps[k]
    draw.append(f"drawtext=fontfile='{F1}':textfile='{tf(k+'_1', t1)}':expansion=none:fontsize=64:fontcolor=0x191F28:x=900:y=440:enable='between(t,{a:.2f},{b:.2f})'")
    draw.append(f"drawtext=fontfile='{F2}':textfile='{tf(k+'_2', t2)}':expansion=none:fontsize=36:fontcolor=0x4E5968:x=900:y=530:enable='between(t,{a:.2f},{b:.2f})'")
draw.append(f"drawtext=fontfile='{F1}':textfile='{tf('brand', 'moduwallet')}':expansion=none:fontsize=34:fontcolor=0x3182F6:x=900:y=120")
draw.append(f"drawtext=fontfile='{F2}':textfile='{tf('foot', 'Demo · real True Markets quotes, simulated fills')}':expansion=none:fontsize=26:fontcolor=0x8B95A1:x=900:y=960")
vf = (f"[0:v]trim=start={off:.2f}:duration={end+0.5:.2f},setpts=PTS-STARTPTS,scale=468:1013:flags=lanczos,"
      f"pad=iw+16:ih+16:8:8:color=0xE5E8EB[ph];"
      f"color=c=0xF2F4F6:s=1920x1080:r=30[bg];[bg][ph]overlay=x=330:y=(H-h)/2:shortest=1," + ",".join(draw) + "[v]")
inputs = ["-i", video]; amix = []
for i, k in enumerate(names):
    inputs += ["-i", O + f"vo/{k}.mp3"]
    ms = int(marks[k] * 1000) + 250
    amix.append(f"[{i+1}:a]adelay={ms}|{ms},apad[a{i}]")
af = ";".join(amix) + ";" + "".join(f"[a{i}]" for i in range(len(names))) + f"amix=inputs={len(names)}:normalize=0,atrim=duration={end+0.5:.2f}[a]"
cmd = ["ffmpeg", "-y", "-loglevel", "error"] + inputs + ["-filter_complex", vf + ";" + af, "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k",
       "-movflags", "+faststart", O + "moduwallet-demo.mp4"]
r = subprocess.run(cmd, capture_output=True, text=True)
print("offset", round(off, 2), "rc", r.returncode, r.stderr[-1200:])
