const kv = await Deno.openKv();

const ADMIN_USER = "admin";
const ADMIN_PASS = "123456";

const port = Number(Deno.env.get("PORT")) || 8080;

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);

  if (url.pathname.startsWith("/sub/")) {
    const userPath = url.pathname.replace("/sub/", "");
    const entry = await kv.get(["configs", userPath]);
    
    if (entry.value) {
      const user = entry.value as any;
      const base64Content = btoa(user.generatedLink);
      return new Response(base64Content, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response("User Not Found", { status: 404 });
  }

  if (url.pathname === "/") {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Access to BPB Panel"' },
      });
    }

    const auth = atob(authHeader.split(" ")[1]).split(":");
    if (auth[0] !== ADMIN_USER || auth[1] !== ADMIN_PASS) {
      return new Response("Forbidden", { status: 403 });
    }

    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BPB Deno Panel</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css" rel="stylesheet">
</head>
<body class="bg-dark text-light p-4">
  <div class="container" style="max-width: 600px;">
    <h3 class="mb-4 text-center">مدیریت کانفیگ BPB</h3>
    <div class="card bg-secondary text-light p-3 mb-4">
      <h5>ساخت کاربر جدید</h5>
      <div class="mb-2"><input type="text" id="name" class="form-control" placeholder="نام کاربر"></div>
      <div class="mb-2"><input type="text" id="uuid" class="form-control" placeholder="UUID"></div>
      <div class="mb-2">
        <select id="protocol" class="form-select">
          <option value="vless-reality">VLESS Reality</option>
          <option value="vless-ws">VLESS WS</option>
        </select>
      </div>
      <div class="mb-2"><input type="text" id="address" class="form-control" placeholder="آدرس / آی‌پی"></div>
      <div class="mb-2"><input type="text" id="sni" class="form-control" placeholder="SNI"></div>
      <div class="mb-2"><input type="text" id="pbk" class="form-control" placeholder="Public Key (برای Reality)"></div>
      <div class="mb-2"><input type="text" id="sid" class="form-control" placeholder="Short ID (برای Reality)"></div>
      <button onclick="createUser()" class="btn btn-success w-100 mt-2">ذخیره و ساخت لینک</button>
    </div>
    <div id="result" class="alert alert-info d-none" style="word-break: break-all;"></div>
  </div>
  <script>
    async function createUser() {
      const body = {
        name: document.getElementById('name').value,
        uuid: document.getElementById('uuid').value,
        protocol: document.getElementById('protocol').value,
        address: document.getElementById('address').value,
        sni: document.getElementById('sni').value,
        pbk: document.getElementById('pbk').value,
        sid: document.getElementById('sid').value
      };
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if(data.status === 'success') {
        const subUrl = window.location.origin + '/sub/' + data.data.id;
        document.getElementById('result').classList.remove('d-none');
        document.getElementById('result').innerHTML = '<b>لینک سابسکرپشن:</b><br>' + subUrl;
      }
    }
  </script>
</body>
</html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  if (url.pathname === "/api/users" && req.method === "POST") {
    const data = await req.json();
    const { name, uuid, protocol, address, sni, pbk, sid } = data;
    
    let generatedLink = "";
    if (protocol === "vless-reality") {
      generatedLink = `vless://${uuid}@${address}:443?security=reality&encryption=none&pbk=${pbk}&headerType=none&fp=chrome&type=tcp&sni=${sni}&sid=${sid}#${encodeURIComponent(name)}`;
    } else {
      generatedLink = `vless://${uuid}@${address}:443?encryption=none&security=tls&type=ws&host=${sni}&sni=${sni}&path=%2F#${encodeURIComponent(name)}`;
    }

    const newUser = { id: uuid, name, uuid, protocol, generatedLink, createdAt: new Date().toISOString() };
    await kv.set(["configs", uuid], newUser);

    return new Response(JSON.stringify({ status: "success", data: newUser }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  return new Response("Not Found", { status: 404 });
});
