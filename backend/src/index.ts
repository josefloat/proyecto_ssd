import { assertRequiredEnv, PORT } from "./env";

assertRequiredEnv();

import { createApp } from "./app";

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
