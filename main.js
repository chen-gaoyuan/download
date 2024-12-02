const Koa = require('koa');
const KoaStatic = require('koa-static');
const path = require('path');
const fs = require('fs/promises');
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
        return (value / 1024).toFixed(1) + 'KB';
    }
    if (value < 1024 * 1024) {
        return Math.floor(value / 1024) + 'KB';
    }
    if (value < 1024 * 1024 * 1024) {
        return Math.floor(value / 1024 / 1024) + 'MB';
    }
    return Math.floor(value / 1024 / 1024 / 1024) + 'GB';
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
            let str = '<tr>';
            if (file.stat.isDirectory()) {
                str += `<td>目录</td>`;
            } else {
                str += `<td>文件</td>`;
            }
            if (file.stat.isDirectory()) {
                str += `<td><a href="${'./' + file.name + '/'}">${file.name}</a></td>`;
            } else {
                str += `<td><a href="${'./' + file.name}">${file.name}</a></td>`;
            }
            const d = file.stat.mtime;
            str += `<td>${d.getFullYear() + 1}-${d.getMonth() + 1}-${formatTimeNum(
                d.getDay(),
            )} ${formatTimeNum(d.getHours())}:${formatTimeNum(d.getMinutes())}:${formatTimeNum(d.getSeconds())}</td>`;

            if (file.stat.isDirectory()) {
                str += `<td>-</td>`;
            } else {
                str += `<td>${getSize(file.stat.size)}</td>`;
            }
            str += `</tr>`;
            return str;
        })
        .join('\n');
    return `<html>
<head><title>Download</title></head>
<body>
<h1>Index of ${url}</h1>
<table style="border-spacing:15px 0px;">
<tbody>
<tr></tr>
<tr><th>Type</th><th>Name</th><th>Last modified</th><th>Size</th></tr>
<tr><th colspan="5"><hr></th></tr>
${bodyStr}
<tr><th colspan="5"><hr></th></tr>
</tbody>
</table>
</body>
</html>`;
};
const staticPath = path.join(__dirname, 'static')
app.use(KoaStatic(staticPath));

app.use(async (ctx) => {
    if (ctx.status != 404) {
        return;
    }
    if (!ctx.url.endsWith('/')) {
        return;
    }
    const dirPath = path.join(staticPath, ctx.url);
    if(!dirPath.startsWith(staticPath)) {
        return
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
            if(name.startsWith('.')) {
                continue
            }
            const stat = await fs.stat(path.join(dirPath, name));
            files.push({ name, stat });
        }
        files.sort(sortFiles);
        ctx.type = 'text/html';
        ctx.body = renderHtml(ctx.url, files);
    } catch (err) {
        ctx.throw(500, err);
    }
});

app.listen(10080, () => {
    console.log('Server is running~');
});
