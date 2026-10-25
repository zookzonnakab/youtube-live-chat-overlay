import path from "path";
import { fileURLToPath } from "url";
import { rcedit } from "rcedit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const exePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "release", "YouTubeLiveChat.exe");
const iconPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(root, "branding", "app.ico");

await rcedit(exePath, { icon: iconPath });
console.log(`Set icon on ${exePath}`);
