import "./profile_edit.css";
import { mePromise, renderMe } from "./auth.js";

const $ = (id) => document.getElementById(id);
const dialog = $("edit-dialog");
const form = $("edit-form");
const errorBox = $("edit-error");
const saveButton = $("edit-save");

let me = null;
let pendingAvatar;

function showPreview(url) {
  $("edit-avatar-preview").style.backgroundImage = url ? `url(${JSON.stringify(url)})` : "";
}

function updateCount() {
  $("bio-count").textContent = `${$("edit-bio").value.length}/300`;
}

async function resizeToDataUrl(file, size = 256) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that image. Try a PNG, JPEG or WebP.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // JPEG has no transparency
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

mePromise.then((user) => {
  if (!user) return;
  me = user;
  $("edit-profile").hidden = false;
});

$("edit-profile").addEventListener("click", () => {
  pendingAvatar = undefined;
  errorBox.textContent = "";
  $("avatar-file").value = "";
  $("edit-username").value = me.username;
  $("edit-dob").value = me.dob ?? "";
  $("edit-dob").max = new Date().toISOString().slice(0, 10);
  $("edit-bio").value = me.bio ?? "";
  updateCount();
  showPreview(me.avatar_url);
  dialog.showModal();
});

$("edit-cancel").addEventListener("click", () => dialog.close());
$("edit-bio").addEventListener("input", updateCount);
$("avatar-choose").addEventListener("click", () => $("avatar-file").click());

$("avatar-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  errorBox.textContent = "";
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("Please choose an image under 10 MB.");
    pendingAvatar = await resizeToDataUrl(file);
    showPreview(pendingAvatar);
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

$("avatar-remove").addEventListener("click", () => {
  pendingAvatar = null;
  $("avatar-file").value = "";
  showPreview(null);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.textContent = "";

  const patch = {};
  const username = $("edit-username").value.trim();
  if (username !== me.username) patch.username = username;
  const dob = $("edit-dob").value;
  if (dob !== (me.dob ?? "")) patch.dob = dob; // "" clears it
  const bio = $("edit-bio").value.trim();
  if (bio !== (me.bio ?? "")) patch.bio = bio;
  if (pendingAvatar !== undefined) patch.avatar_url = pendingAvatar;

  if (Object.keys(patch).length === 0) {
    dialog.close();
    return;
  }

  saveButton.disabled = true;
  try {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errorBox.textContent = data.error || "Couldn't save your changes.";
      return;
    }
    me = await (await fetch("/api/me")).json(); // reload so we show exactly what was saved
    renderMe(me);
    dialog.close();
  } catch {
    errorBox.textContent = "Can't reach the server. Is `npm run server` running?";
  } finally {
    saveButton.disabled = false;
  }
});