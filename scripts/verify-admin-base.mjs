process.env.APP_BASE_PATH = "/admin";

const { createApp } = await import("../dist/app.js");
const app = createApp();
const server = app.listen(0);

try {
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  for (const path of ["/", "/customer", "/admin", "/admin/customer"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const html = await response.text();
    console.log(
      path,
      response.status,
      html.includes('/admin/assets/zigo-logo-new.png'),
      html.includes('/admin/styles.css'),
      html.includes('/admin/app.js'),
      html.includes('/admin/portal.css'),
      html.includes('/admin/portal.js'),
      html.includes('src="./assets/')
    );
  }
} finally {
  server.close();
}
