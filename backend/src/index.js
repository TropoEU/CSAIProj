import express from "express";
import dotenv from "dotenv";
import toolRoutes from "./routes/tools.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/tools", toolRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
