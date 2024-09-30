const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const uuid = require("uuid");
const fs = require("fs");
const path = require("path");
const jsQR = require("jsqr");
const Jimp = require("jimp");
const QrCode = require("qrcode-reader");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

async function fetchDataFromQr(base64Image) {
  try {
    // Remove the metadata prefix from the base64 string
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Read the image from buffer
    const img = await Jimp.read(buffer);

    // Wrap the QR decoding in a promise
    return await new Promise((resolve, reject) => {
      const qr = new QrCode();
      qr.callback = (error, result) => {
        if (error) {
          console.error("Error decoding QR code:", error);
          return reject("Error decoding QR code");
        }

        if (result) {
          const data = result.result;
          console.log("Decoded data:", data);
          return resolve(data);
        } else {
          console.log("No QR code found.");
          return reject("No QR code found");
        }
      };

      qr.decode(img.bitmap);
    });
  } catch (err) {
    console.error("Error reading image:", err);
    throw err; // Re-throw the error so it can be handled by the caller
  }
}

//Transaction Level APIs:
app.post("/create-order", async (req, res) => {
  const {
    order_id,
    order_amount,
    customer_details,
    order_currency = "INR",
    order_meta,
    order_expiry_time,
    order_note,
    order_tags,
    order_splits,
    cart_details,
  } = req.body;

  // Replace with your actual API endpoint and key
  const apiEndpoint = "https://sandbox.cashfree.com/pg/orders";
  const apiKey = "CYjPFSLzKTp42b3e7f4206234e1306c0deb21d1a0927e7be8123"; // Use your actual API key
  const apiVersion = "2023-08-01"; // Required header

  // Create request payload
  const data = {
    order_id,
    order_amount,
    order_currency,
    customer_details, // Required, even if dummy details
    order_meta,
    order_expiry_time,
    order_note,
    order_tags,
    order_splits,
    cart_details,
  };

  try {
    // Make API call to Cashfree's create order endpoint
    const response = await axios.post(apiEndpoint, data, {
      headers: {
        "Content-Type": "application/json",
        "x-partner-apikey": apiKey,
        "x-api-version": apiVersion,
        "x-request-id": uuid.v4(), // Unique request ID for tracking
        "x-idempotency-key": uuid.v4(), // Unique key for retrying without duplicate actions
        "x-partner-merchantid": "sanskar123",
      },
    });

    // Send response to client
    res.status(200).json({
      message: "Order created successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error creating order:",
      error.response?.data || error.message
    );
    res.status(500).json({
      message: "Failed to create order",
      error: error.response?.data || error.message,
    });
  }
});

app.get("/get-order", async (req, res) => {
  const orderId = req.query.order_id;
  const apiEndpoint = `https://sandbox.cashfree.com/pg/orders/${orderId}`;
  const apiKey = "CYjPFSLzKTp42b3e7f4206234e1306c0deb21d1a0927e7be8123"; // Use your actual API key
  const apiVersion = "2023-08-01"; // Required header
  const merchantid = "sanskar123";
  const headers = {
    "Content-Type": "application/json",
    "x-partner-apikey": apiKey,
    "x-api-version": apiVersion,
    "x-partner-merchantid": merchantid,
  };

  try {
    const response = await axios.get(apiEndpoint, { headers });

    res.status(200).json({
      message: "Order fetched successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error fetching order:",
      error.response?.data || error.message
    );
    res.status(500).json({
      message: "Failed to fetch order",
      error: error.response?.data || error.message,
    });
  }
});

app.patch("/terminate-order", async (req, res) => {
  const orderId = req.query.order_id;
  const apiEndpoint = `https://sandbox.cashfree.com/pg/orders/${orderId}`;
  const apiKey = "CYjPFSLzKTp42b3e7f4206234e1306c0deb21d1a0927e7be8123";
  const merchantid = "sanskar123";
  const apiVersion = "2023-08-01";

  const status = req.body.status;

  const headers = {
    "Content-Type": "application/json",
    "x-partner-apikey": apiKey,
    "x-api-version": apiVersion,
    "x-partner-merchantid": merchantid,
  };

  try {
    const response = await axios.patch(
      apiEndpoint,
      { order_status: status },
      { headers }
    );

    console.log("Order terminated successfully:", response);

    res.status(200).json({
      message: "Order terminated successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error terminating order:",
      error.response?.data || error.message
    );
    res.status(500).json({
      message: "Failed to terminate order",
      error: error.response?.data || error.message,
    });
  }
});

app.get("/extended-details", async (req, res) => {
  const order_id = req.query.order_id;
  const apiEndpoint = `https://sandbox.cashfree.com/pg/orders/${order_id}/extended`;
  const apiKey = "CYjPFSLzKTp42b3e7f4206234e1306c0deb21d1a0927e7be8123";
  const merchantid = "sanskar123";
  const apiVersion = "2023-08-01";

  const headers = {
    "Content-Type": "application/json",
    "x-partner-apikey": apiKey,
    "x-api-version": apiVersion,
    "x-partner-merchantid": merchantid,
  };

  try {
    const response = await axios.get(apiEndpoint, {
      headers,
    });

    res.status(200).json({
      message: "Order details fetched successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error fetching order details:",
      error.response?.data || error.message
    );
    res.status(500).json({
      message: "Failed to fetch order details",
      error: error.response?.data || error.message,
    });
  }
});

app.post("/order-payment", async (req, res) => {
  const apiVersion = "2023-08-01";

  const headers = {
    "Content-Type": "application/json",
    "x-api-version": apiVersion,
  };

  const payment_session_id = req.body.payment_session_id;

  console.log("Payment session ID:", payment_session_id);

  const body = {
    payment_method: {
      card: {
        channel: "link",
      },
      upi: {
        channel: "link", //change this to "qrcode" for UPI QR code
      },
    },
    payment_session_id,
  };

  console.log("Payment body:", body);

  try {
    const response = await axios.post(
      "https://sandbox.cashfree.com/pg/orders/sessions",
      body,
      { headers }
    );

    const responseData = response.data;

    if (responseData?.data?.payload?.qrcode) {
      // Use the base64 qrcode directly as imageUrl
      const base64Image = responseData.data.payload.qrcode;
      try {
        const decodedData = await fetchDataFromQr(base64Image);
        responseData.data.payload.imageUrl = decodedData; // Add decoded data to the response
      } catch (err) {
        console.error("Error fetching data from QR code:", err);
        responseData.data.payload.imageUrl = "QR decoding failed";
      }
    }

    res.status(200).json({
      message: "Payment initiated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error(
      "Error initiating payment:",
      error.response?.data || error.message
    );
    res.status(500).json({
      message: "Failed to initiate payment",
      error: error.response?.data || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
