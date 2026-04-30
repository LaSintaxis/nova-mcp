const servers = [
  "localhost",
  ".",
  "(local)",
  "E-23YP6S2",
  "E-23YP6S2\\MSSQLSERVER"
];

for (const server of servers) {
  console.log(`\nProbando: ${server}`);
  try {
    const config = {
      server: server,
      database: "master",
      options: { trustedConnection: true, trustServerCertificate: true, encrypt: false }
    };
    const pool = await sql.connect(config);
    console.log(`✅ FUNCIONA con: ${server}`);
    await pool.close();
    break;
  } catch (error) {
    console.log(`❌ No funciona con: ${server}`);
  }
}