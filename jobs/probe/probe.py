# Gateway 탐색: 토큰 발급, 종목 목록, 데모 사용자 생성, 잔고 없이 견적(주문 생성만, 실행 안 함).
# 돈은 움직이지 않는다 - execute 를 부르지 않는다.
#   python -I jobs/probe/probe.py
import base64
import json
import os
import sys
import time
from collections import Counter

import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

API = "https://api.truemarkets.co"
CRED = r"D:\credentials.env"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "tmp", "probe")


def load_env():
    env = {}
    for line in open(CRED, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip("'").strip('"')
    return env


def append_env(lines):
    with open(CRED, "a", encoding="utf-8") as f:
        f.write("\n" + "\n".join(lines) + "\n")


def b64url_int(v):
    return int.from_bytes(base64.urlsafe_b64decode(v + "=" * (-len(v) % 4)), "big")


token = ""


def call(method, path, body=None, headers=None):
    res = requests.request(
        method, f"{API}{path}", json=body, timeout=60,
        headers={**({"Authorization": f"Bearer {token}"} if token else {}), **(headers or {})},
    )
    data = res.json() if res.content else {}
    return res.status_code, data


def save(name, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    global token
    env = load_env()

    # 1) 종목 목록 (토큰 불필요)
    for q in ["", "?asset_class=crypto,stock"]:
        st, data = call("GET", f"/v1/gateway/assets{q}")
        assets = data.get("data", [])
        save(f"assets{q.replace('?', '_').replace('=', '-').replace(',', '+')}.json", data)
        print(f"assets{q}: {st} n={len(assets)}")
        print("  by class/chain/venue:", Counter((a.get("asset_class"), a.get("chain"), a.get("venue")) for a in assets))
    stocks = [a for a in assets if a.get("asset_class") == "stock"]
    print("  stocks:", sorted({a["symbol"] for a in stocks}))

    # 2) 토큰
    jwk = json.loads(env["TRUEMARKETS_PRIVATE_JWK"])
    key_id = env["TRUEMARKETS_KEY_ID"]
    pk = ec.EllipticCurvePrivateNumbers(
        b64url_int(jwk["d"]),
        ec.EllipticCurvePublicNumbers(b64url_int(jwk["x"]), b64url_int(jwk["y"]), ec.SECP256R1()),
    ).private_key()
    ts = int(time.time())
    r, s = decode_dss_signature(pk.sign(f"{key_id}.{ts}".encode(), ec.ECDSA(hashes.SHA256())))
    sig = base64.urlsafe_b64encode(r.to_bytes(32, "big") + s.to_bytes(32, "big")).rstrip(b"=").decode()
    st, minted = call("POST", "/v1/auth/api-key/token", {"key_id": key_id, "timestamp": ts, "signature": sig})
    print("token:", st, {k: v for k, v in minted.items() if k != "access_token"})
    if st != 200:
        sys.exit(1)
    token = minted["access_token"]
    claims = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
    org = claims["tm"]["organization_id"]
    print("org:", org)

    # 3) 데모 사용자용 signer 키 (한 번 만들면 그 사용자는 이 키로만 서명 가능 -> credentials 에 보관)
    if "TRUEMARKETS_DEMO_SIGNER_PRIV" not in env:
        k = ec.generate_private_key(ec.SECP256R1())
        pub = k.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint).hex()
        priv = k.private_numbers().private_value.to_bytes(32, "big").hex()
        append_env(["# True Markets demo user signer key (P-256, hex)",
                    f"TRUEMARKETS_DEMO_SIGNER_PUB={pub}", f"TRUEMARKETS_DEMO_SIGNER_PRIV={priv}"])
        env = load_env()
    pub = env["TRUEMARKETS_DEMO_SIGNER_PUB"]

    user = {}
    for attempt in range(5):
        st, user = call("POST", f"/v1/account/organizations/{org}/users",
                        {"external_ref_id": "demo_user_1", "signer_public_key": pub})
        if st in (200, 201) and user.get("wallets"):
            break
        print("  user attempt", attempt, st, user)
        time.sleep(2)
    print("user:", st, user.get("user_id"), [(w.get("chain_family"), w.get("address")) for w in user.get("wallets", [])])
    save("user.json", user)
    uid = user["user_id"]
    hdr = {"TM-On-Behalf-Of": uid}

    st, bal = call("GET", "/v1/gateway/balances", headers=hdr)
    print("balances:", st, bal)

    # 4) 잔고 없이 주문 생성(=견적). 실행하지 않음.
    targets = [a for a in assets if a["symbol"] in ("SOL",) and a.get("chain") == "solana"] + stocks[:2]
    for a in targets:
        st, order = call("POST", "/v1/gateway/orders",
                         {"asset_id": a["id"], "qty": "2", "qty_unit": "quote", "side": "buy", "type": "market"},
                         headers=hdr)
        save(f"order_{a['symbol']}.json", order)
        q = order.get("quote", {})
        print(f"order {a['symbol']}/{a.get('chain')}: {st} order_id={order.get('order_id')!r} "
              f"issues={q.get('issues')} keys={list(order.keys())} quote_keys={list(q.keys())}")
        if st >= 400:
            print("   ", order)


if __name__ == "__main__":
    main()
