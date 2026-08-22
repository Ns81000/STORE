// Interactive bcrypt hash generator for AUTH_PASSWORD_HASH (cost 12, spec §3.1).
// The plaintext password is read with echoing disabled and never written anywhere.
// Usage: pnpm hash-password
import { stdin, stdout, exit } from "node:process";
import bcrypt from "bcryptjs";

function readHidden(prompt) {
  return new Promise((resolve) => {
    stdout.write(prompt);
    let input = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          stdin.removeAllListeners("data");
          resolve(input);
          return;
        }
        if (char === "\u0003") {
          stdout.write("\n");
          exit(1);
        }
        if (char === "\u0008" || char === "\u007f") {
          input = input.slice(0, -1);
          continue;
        }
        input += char;
      }
    });
  });
}

const password = await readHidden("Choose the STORE password: ");
const confirmation = await readHidden("Repeat it to confirm: ");

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  exit(1);
}
if (password !== confirmation) {
  console.error("Passwords do not match.");
  exit(1);
}

const hash = bcrypt.hashSync(password, 12);
if (!bcrypt.compareSync(password, hash)) throw new Error("hash self-check failed");

console.log("\nAUTH_PASSWORD_HASH (bcrypt, cost 12):");
console.log(hash);
console.log("\nPaste this value into .env locally and into the Vercel project settings.");
console.log("Do not commit the plaintext password anywhere.");
exit(0);
