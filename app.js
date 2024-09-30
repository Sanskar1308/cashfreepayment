const Jimp = require("jimp");
const QrCode = require("qrcode-reader");

async function fetchUpiFromQr(base64Image) {
  try {
    // Remove the metadata prefix from the base64 string
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Read the image from buffer
    const img = await Jimp.read(buffer);

    const qr = new QrCode();
    qr.callback = (error, result) => {
      if (error) {
        console.error("Error decoding QR code:", error);
        return;
      }

      if (result) {
        const data = result.result;
        console.log("data:", data);

        if (data.includes("upi://")) {
          console.log(`UPI URL: ${data}`);
        } else {
          console.log("UPI URL not found in QR code.");
        }
      } else {
        console.log("No QR code found.");
      }
    };

    qr.decode(img.bitmap);
  } catch (err) {
    console.error("Error reading image:", err);
  }
}

// Example usage
const base64Image =
  "data:image/png;base64,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"; // Your base64 string here
fetchUpiFromQr(base64Image);
