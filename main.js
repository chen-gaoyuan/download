require("dotenv/config");
const Koa = require("koa");
const KoaStatic = require("koa-static");
const path = require("path");
const fs = require("fs/promises");
const app = new Koa();
const sortFiles = (a, b) => {
  if (a.stat.isDirectory()) {
    if (b.stat.isDirectory()) {
      return a.name - b.name;
    } else {
      return -1;
    }
  } else {
    if (b.stat.isDirectory()) {
      return 1;
    } else {
      return a.name - b.name;
    }
  }
};
const getSize = (value) => {
  if (value < 1024) {
    return (value / 1024).toFixed(1) + "KB";
  }
  if (value < 1024 * 1024) {
    return Math.floor(value / 1024) + "KB";
  }
  if (value < 1024 * 1024 * 1024) {
    return Math.floor(value / 1024 / 1024) + "MB";
  }
  return Math.floor(value / 1024 / 1024 / 1024) + "GB";
};
const formatTimeNum = (num) => {
  if (num < 10) {
    return `0${num}`;
  }
  return `${num}`;
};
const renderHtml = (url, files) => {
  const bodyStr = files
    .map((file) => {
      let str = "<tr>";
      if (file.stat.isDirectory()) {
        str += `<td>目录</td>`;
      } else {
        str += `<td>文件</td>`;
      }
      if (file.stat.isDirectory()) {
        str += `<td><a href="${"./" + file.name + "/"}">${file.name}</a></td>`;
      } else {
        str += `<td><a href="${"./" + file.name}">${file.name}</a></td>`;
      }
      const d = file.stat.mtime;
      str += `<td>${d.getFullYear()}-${d.getMonth() + 1}-${formatTimeNum(
        d.getDay()
      )} ${formatTimeNum(d.getHours())}:${formatTimeNum(
        d.getMinutes()
      )}:${formatTimeNum(d.getSeconds())}</td>`;

      if (file.stat.isDirectory()) {
        str += `<td>-</td>`;
      } else {
        str += `<td>${getSize(file.stat.size)}</td>`;
      }
      if (process.env.COUNTER == "1") {
        str += `<td>${file.stat.isFile() ? file.count : "-"}</td>`;
      }
      if (process.env.DESCRIPTION == "1") {
        str += `<td>${file.des || "-"}</td>`;
      }
      str += `</tr>`;
      return str;
    })
    .join("\n");
  return `<html><head><title>Download</title></head>
<body><h1>Index of ${url}</h1><table style="border-spacing:15px 0px;"><tbody>
<tr>
  <th>Type</th><th>Name</th><th>Last modified</th><th>Size</th>
  ${process.env.COUNTER == "1" ? "<th>Count</th>" : ""}
  ${process.env.DESCRIPTION == "1" ? "<th>Description</th>" : ""}
</tr>
<tr><th colspan="6"><hr></th></tr>
${bodyStr}
<tr><th colspan="6"><hr></th></tr>
</tbody></table></body></html>`;
};
const staticPath = path.join(__dirname, "static");
if (process.env.COUNTER == "1") {
  app.use(async (ctx, next) => {
    await next();
    if (ctx.url.endsWith("/")) {
      return;
    }
    if (ctx.status != 200) {
      return;
    }
    const filePath = path.join(staticPath, ctx.url);
    const fileName = path.basename(filePath);
    if (fileName.startsWith(".")) {
      return;
    }
    const dirPath = path.dirname(filePath);
    const countFilePath = path.join(dirPath, ".cnt." + fileName);
    let count;
    try {
      count = parseInt(await fs.readFile(countFilePath, "utf-8"));
    } catch {
      count = 0;
    }
    count++;
    await fs.writeFile(countFilePath, count.toString());
  });
}

app.use(KoaStatic(staticPath, { hidden: true }));

app.use(async (ctx) => {
  if (ctx.status != 404) {
    return;
  }
  if (!ctx.url.endsWith("/")) {
    return;
  }
  const dirPath = path.join(staticPath, ctx.url);
  if (!dirPath.startsWith(staticPath)) {
    return;
  }
  try {
    await fs.access(dirPath, fs.constants.F_OK);
    const dirStat = await fs.stat(dirPath);
    if (!dirStat.isDirectory()) {
      return;
    }
    const names = await fs.readdir(dirPath);
    const files = [];
    for (const name of names) {
      if (name.startsWith(".")) {
        continue;
      }
      const filePath = path.join(dirPath, name);
      const stat = await fs.stat(filePath);
      let count = 0;
      if (process.env.COUNTER == "1" && stat.isFile()) {
        try {
          const countPath = path.join(dirPath, ".cnt." + name);
          count = parseInt(await fs.readFile(countPath, "utf-8"));
        } catch {}
      }
      let des = "";
      if (process.env.DESCRIPTION == "1") {
        try {
          const desPath = path.join(dirPath, ".des." + name);
          des = await fs.readFile(desPath, "utf-8");
        } catch {}
      }
      files.push({ name, stat, des, count });
    }
    files.sort(sortFiles);
    ctx.type = "text/html";
    ctx.body = renderHtml(ctx.url, files);
  } catch (err) {
    ctx.throw(500, err);
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 80;
app.listen(port, () => {
  console.log(`Server is running on http://127.0.0.1:${port}`);
});
