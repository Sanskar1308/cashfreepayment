require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const uuid = require("uuid");
const Jimp = require("jimp");
const QrCode = require("qrcode-reader");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const CASHFREE_API_ENDPOINT = "https://sandbox.cashfree.com/pg";
const API_VERSION = "2023-08-01";
const PARTNER_MERCHANT_ID = "sanskar123";
const API_KEY = process.env.CASHFREE_API_KEY; // Store API key in .env file

const generateHeaders = (extraHeaders = {}) => ({
  "Content-Type": "application/json",
  "x-partner-apikey": API_KEY,
  "x-api-version": API_VERSION,
  "x-partner-merchantid": PARTNER_MERCHANT_ID,
  ...extraHeaders,
});

// Extract QR code data
async function fetchDataFromQr(base64Image) {
  try {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const img = await Jimp.read(buffer);

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
        return resolve(result.result);
      };
      qr.decode(img.bitmap);
    });
  } catch (err) {
    console.error("Error reading image:", err);
    throw err;
  }
}

// Error handling function
const handleError = (res, error, message) => {
  console.error(message, error.response?.data || error.message);
  res.status(500).json({
    message,
    error: error.response?.data || error.message,
  });
};

// Transaction Level APIs:
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

  const data = {
    order_id,
    order_amount,
    order_currency,
    customer_details,
    order_meta,
    order_expiry_time,
    order_note,
    order_tags,
    order_splits,
    cart_details,
  };

  try {
    const response = await axios.post(`${CASHFREE_API_ENDPOINT}/orders`, data, {
      headers: generateHeaders({
        "x-request-id": uuid.v4(),
        "x-idempotency-key": uuid.v4(),
      }),
    });

    res.status(200).json({
      message: "Order created successfully",
      data: response.data,
    });
  } catch (error) {
    handleError(res, error, "Failed to create order");
  }
});

app.get("/get-order", async (req, res) => {
  const orderId = req.query.order_id;

  try {
    const response = await axios.get(
      `${CASHFREE_API_ENDPOINT}/orders/${orderId}`,
      {
        headers: generateHeaders(),
      }
    );

    res.status(200).json({
      message: "Order fetched successfully",
      data: response.data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch order");
  }
});

app.patch("/terminate-order", async (req, res) => {
  const orderId = req.query.order_id;
  const status = req.body.status;

  try {
    const response = await axios.patch(
      `${CASHFREE_API_ENDPOINT}/orders/${orderId}`,
      { order_status: status },
      { headers: generateHeaders() }
    );

    res.status(200).json({
      message: "Order terminated successfully",
      data: response.data,
    });
  } catch (error) {
    handleError(res, error, "Failed to terminate order");
  }
});

app.get("/extended-details", async (req, res) => {
  const order_id = req.query.order_id;

  try {
    const response = await axios.get(
      `${CASHFREE_API_ENDPOINT}/orders/${order_id}/extended`,
      {
        headers: generateHeaders(),
      }
    );

    res.status(200).json({
      message: "Order details fetched successfully",
      data: response.data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch order details");
  }
});

app.post("/order-payment", async (req, res) => {
  const payment_session_id = req.body.payment_session_id;

  const body = {
    payment_method: {
      card: { channel: "link" },
      upi: { channel: "link" },
    },
    payment_session_id,
  };

  try {
    const response = await axios.post(
      `${CASHFREE_API_ENDPOINT}/orders/sessions`,
      body,
      { headers: generateHeaders() }
    );

    const responseData = response.data;

    if (responseData?.data?.payload?.qrcode) {
      const base64Image = responseData.data.payload.qrcode;
      try {
        const decodedData = await fetchDataFromQr(base64Image);
        responseData.data.payload.imageUrl = decodedData;
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
    handleError(res, error, "Failed to initiate payment");
  }
});

app.get("/all-payment-status", async (req, res) => {
  const order_id = req.query.order_id;

  try {
    const response = await axios.get(
      `${CASHFREE_API_ENDPOINT}/orders/${order_id}/payments`,
      {
        headers: generateHeaders(),
      }
    );

    res.status(200).json({
      message: "Payment status fetched successfully",
      data: response.data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch payment status");
  }
});

app.get("/payment-status", async (req, res) => {
  const { payment_id, order_id } = req.query;

  try {
    const response = await axios.get(
      `${CASHFREE_API_ENDPOINT}/orders/${order_id}/payments/${payment_id}`,
      { headers: generateHeaders() }
    );

    res.status(200).json({
      message: "Payment status fetched successfully",
      data: response.data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch payment status");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
