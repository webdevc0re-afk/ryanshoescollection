import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DEFAULT_SHEETS_ID = process.env.VITE_GOOGLE_SHEETS_ID || '1xLu9-_zAnCBuRBrostl2nBR01NWRXipKxxNl2560DME';
const DEFAULT_DRIVE_FOLDER_ID = process.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '1xHTKf5DgUmOnRMnItRlGA9yUyiprmBNw';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health & Gateway Configuration Status
  app.get('/api/health', (_req: Request, res: Response) => {
    const paymongoConfigured = Boolean(process.env.PAYMONGO_SECRET_KEY && process.env.PAYMONGO_SECRET_KEY.trim().length > 0);
    const mayaConfigured = Boolean(
      process.env.MAYA_SECRET_KEY &&
      process.env.MAYA_SECRET_KEY.trim().length > 0 &&
      process.env.MAYA_PUBLIC_KEY &&
      process.env.MAYA_PUBLIC_KEY.trim().length > 0
    );

    res.json({
      status: 'ok',
      brand: "RYAN'S SHOES COLLECTION",
      gateways: {
        paymongo: paymongoConfigured,
        maya: mayaConfigured,
      },
      merchantAccounts: {
        gcashNumber: process.env.VITE_MERCHANT_GCASH_NUMBER || '0917-555-0148',
        gcashName: process.env.VITE_MERCHANT_GCASH_NAME || "RYAN'S SHOES COLLECTION",
        mayaNumber: process.env.VITE_MERCHANT_MAYA_NUMBER || '0918-555-0192',
        mayaName: process.env.VITE_MERCHANT_MAYA_NAME || "RYAN'S SHOES COLLECTION",
      },
    });
  });

  app.get('/api/payments/gateway-status', (_req: Request, res: Response) => {
    const paymongoConfigured = Boolean(process.env.PAYMONGO_SECRET_KEY?.trim());
    const mayaConfigured = Boolean(process.env.MAYA_SECRET_KEY?.trim() && process.env.MAYA_PUBLIC_KEY?.trim());
    res.json({
      paymongoConfigured,
      mayaConfigured,
      gcashMode: paymongoConfigured ? 'official_gateway' : 'merchant_reference_verification',
      mayaMode: (mayaConfigured || paymongoConfigured) ? 'official_gateway' : 'merchant_reference_verification',
      merchantAccounts: {
        gcashNumber: process.env.VITE_MERCHANT_GCASH_NUMBER || '0917-555-0148',
        gcashName: process.env.VITE_MERCHANT_GCASH_NAME || "RYAN'S SHOES COLLECTION",
        mayaNumber: process.env.VITE_MERCHANT_MAYA_NUMBER || '0918-555-0192',
        mayaName: process.env.VITE_MERCHANT_MAYA_NAME || "RYAN'S SHOES COLLECTION",
      },
    });
  });

  // Official Philippine Payment Gateway Checkout Session Architecture
  // Never simulates fake successful payments. Only calls live gateway when credentials are configured.
  app.post('/api/payments/create-intent', async (req: Request, res: Response) => {
    const { method, orderId, amount, customerName, customerEmail, contactNumber } = req.body || {};

    if (!method || !orderId || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'Invalid payment intent payload.' });
      return;
    }

    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    if (method === 'GCash' && process.env.PAYMONGO_SECRET_KEY?.trim()) {
      try {
        const authHeader = Buffer.from(`${process.env.PAYMONGO_SECRET_KEY.trim()}:`).toString('base64');
        const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${authHeader}`,
          },
          body: JSON.stringify({
            data: {
              attributes: {
                billing: {
                  name: customerName || 'Customer',
                  email: customerEmail || '',
                  phone: contactNumber || '',
                },
                line_items: [
                  {
                    currency: 'PHP',
                    amount: Math.round(amount * 100),
                    name: `RYAN'S SHOES COLLECTION — Order ${orderId}`,
                    quantity: 1,
                  },
                ],
                payment_method_types: ['gcash'],
                reference_number: orderId,
                success_url: `${appUrl}/?track=${encodeURIComponent(orderId)}`,
                cancel_url: `${appUrl}/?track=${encodeURIComponent(orderId)}`,
              },
            },
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          res.status(502).json({
            gatewayConfigured: true,
            error: payload?.errors?.[0]?.detail || 'PayMongo checkout session creation failed.',
          });
          return;
        }

        res.json({
          gatewayConfigured: true,
          provider: 'paymongo',
          sessionId: payload?.data?.id,
          checkoutUrl: payload?.data?.attributes?.checkout_url,
        });
        return;
      } catch (err) {
        res.status(502).json({
          gatewayConfigured: true,
          error: err instanceof Error ? err.message : 'Payment gateway network error.',
        });
        return;
      }
    }

    if (method === 'Maya' && process.env.MAYA_PUBLIC_KEY?.trim() && process.env.MAYA_SECRET_KEY?.trim()) {
      try {
        const authHeader = Buffer.from(`${process.env.MAYA_PUBLIC_KEY.trim()}:`).toString('base64');
        const response = await fetch('https://pg.paymaya.com/checkout/v1/checkouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${authHeader}`,
          },
          body: JSON.stringify({
            totalAmount: {
              value: Number(amount.toFixed(2)),
              currency: 'PHP',
            },
            buyer: {
              firstName: customerName || 'Customer',
              contact: {
                email: customerEmail || '',
                phone: contactNumber || '',
              },
            },
            requestReferenceNumber: orderId,
            redirectUrl: {
              success: `${appUrl}/?track=${encodeURIComponent(orderId)}`,
              failure: `${appUrl}/?track=${encodeURIComponent(orderId)}`,
              cancel: `${appUrl}/?track=${encodeURIComponent(orderId)}`,
            },
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          res.status(502).json({
            gatewayConfigured: true,
            error: payload?.message || 'Maya checkout creation failed.',
          });
          return;
        }

        res.json({
          gatewayConfigured: true,
          provider: 'maya',
          sessionId: payload?.checkoutId,
          checkoutUrl: payload?.redirectUrl,
        });
        return;
      } catch (err) {
        res.status(502).json({
          gatewayConfigured: true,
          error: err instanceof Error ? err.message : 'Maya gateway network error.',
        });
        return;
      }
    }

    // Gateway credentials not configured — return transparent manual verification workflow
    res.json({
      gatewayConfigured: false,
      mode: 'merchant_reference_verification',
      method,
      orderId,
      message:
        'Official online payment gateway credentials are not configured in server secrets. Complete payment using the merchant instructions and submit your transaction reference number for admin verification.',
    });
  });

  // Google Drive: List images inside configured Drive Folder
  app.get('/api/workspace/drive/files', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Google Workspace Bearer token.' });
      return;
    }

    const folderId = typeof req.query.folderId === 'string' && req.query.folderId.trim()
      ? req.query.folderId.trim()
      : DEFAULT_DRIVE_FOLDER_ID;

    try {
      const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent('files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, createdTime, size)');
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime desc&pageSize=50`,
        {
          headers: { Authorization: authHeader },
        }
      );

      const data = await driveRes.json();
      if (!driveRes.ok) {
        res.status(driveRes.status).json({ error: data?.error?.message || 'Failed to read Google Drive folder.' });
        return;
      }

      res.json({ folderId, files: data.files || [] });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Google Drive request failed.' });
    }
  });

  // Google Drive: Upload product image (base64 payload) directly into folder
  app.post('/api/workspace/drive/upload', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Google Workspace Bearer token.' });
      return;
    }

    const { fileName, mimeType, base64Data, folderId } = req.body || {};
    if (!fileName || !mimeType || !base64Data) {
      res.status(400).json({ error: 'fileName, mimeType, and base64Data are required.' });
      return;
    }

    const targetFolder = typeof folderId === 'string' && folderId.trim() ? folderId.trim() : DEFAULT_DRIVE_FOLDER_ID;
    const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');

    try {
      const boundary = `rsc_boundary_${Date.now()}`;
      const metadata = JSON.stringify({
        name: fileName,
        parents: [targetFolder],
      });

      const pre = Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`,
        'utf-8'
      );
      const bodyBase64 = Buffer.from(fileBuffer.toString('base64'), 'utf-8');
      const post = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
      const multipartBody = Buffer.concat([pre, bodyBase64, post]);

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink',
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      const uploaded = await uploadRes.json();
      if (!uploadRes.ok) {
        res.status(uploadRes.status).json({ error: uploaded?.error?.message || 'Google Drive upload failed.' });
        return;
      }

      // Make file readable via link so storefront shoppers can load the image
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      }).catch(() => undefined);

      const displayUrl = `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w1000`;

      res.json({
        fileId: uploaded.id,
        name: uploaded.name,
        webViewLink: uploaded.webViewLink,
        imageUrl: displayUrl,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Google Drive upload error.' });
    }
  });

  // Google Sheets: Fetch metadata (sheet tab names)
  app.get('/api/workspace/sheets/metadata', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Google Workspace Bearer token.' });
      return;
    }

    const spreadsheetId = typeof req.query.spreadsheetId === 'string' && req.query.spreadsheetId.trim()
      ? req.query.spreadsheetId.trim()
      : DEFAULT_SHEETS_ID;

    try {
      const sheetRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties`,
        {
          headers: { Authorization: authHeader },
        }
      );
      const data = await sheetRes.json();
      if (!sheetRes.ok) {
        res.status(sheetRes.status).json({ error: data?.error?.message || 'Failed to read spreadsheet metadata.' });
        return;
      }

      res.json({
        spreadsheetId,
        title: data?.properties?.title || 'Spreadsheet',
        tabs: (data?.sheets || []).map((s: { properties?: { sheetId?: number; title?: string } }) => ({
          sheetId: s.properties?.sheetId,
          title: s.properties?.title,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Google Sheets metadata request failed.' });
    }
  });

  // Google Sheets: Backup Products, Orders, Payments & Sales Summary
  app.post('/api/workspace/sheets/sync', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Google Workspace Bearer token.' });
      return;
    }

    const { spreadsheetId: rawId, products = [], orders = [], summary = {} } = req.body || {};
    const spreadsheetId = typeof rawId === 'string' && rawId.trim() ? rawId.trim() : DEFAULT_SHEETS_ID;

    try {
      // Step 1: Fetch existing tabs first (never assume "Sheet1")
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`,
        { headers: { Authorization: authHeader } }
      );
      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        res.status(metaRes.status).json({ error: metaData?.error?.message || 'Failed to inspect target Google Sheet.' });
        return;
      }

      const existingTitles = new Set<string>(
        (metaData.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title || '')
      );
      const requiredTabs = ['Products_Inventory', 'Orders_Backup', 'Payments_Ledger', 'Sales_Summary'];
      const tabsToCreate = requiredTabs.filter((t) => !existingTitles.has(t));

      if (tabsToCreate.length > 0) {
        const batchRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: tabsToCreate.map((title) => ({
                addSheet: { properties: { title } },
              })),
            }),
          }
        );
        if (!batchRes.ok) {
          const batchErr = await batchRes.json();
          res.status(batchRes.status).json({ error: batchErr?.error?.message || 'Failed to create backup tabs.' });
          return;
        }
      }

      // Step 2: Prepare tabular data
      const productRows = [
        ['ID', 'Name', 'Brand', 'Category', 'Age Group', 'Price (PHP)', 'Discount %', 'Effective Price (PHP)', 'Total Stock', 'Status', 'Colors', 'Sizes'],
        ...products.map((p: Record<string, unknown>) => {
          const price = Number(p.price || 0);
          const disc = Number(p.discountPercent || 0);
          const eff = Math.round(price * (1 - disc / 100));
          return [
            String(p.id || ''),
            String(p.name || ''),
            String(p.brand || ''),
            String(p.category || ''),
            String(p.ageGroup || ''),
            price,
            disc,
            eff,
            Number(p.stock || 0),
            p.active ? 'Active' : 'Hidden',
            Array.isArray(p.colors) ? p.colors.join(', ') : '',
            Array.isArray(p.sizes) ? p.sizes.join(', ') : '',
          ];
        }),
      ];

      const orderRows = [
        ['Tracking Code', 'Customer Name', 'Contact Number', 'Region', 'Delivery Address', 'Items Count', 'Subtotal (PHP)', 'Shipping (PHP)', 'Total (PHP)', 'Order Status', 'Stock Deducted', 'Created At'],
        ...orders.map((o: Record<string, unknown>) => [
          String(o.trackingCode || ''),
          String(o.customerName || ''),
          String(o.contactNumber || ''),
          String(o.region || ''),
          String(o.deliveryAddress || ''),
          Array.isArray(o.items) ? o.items.length : 0,
          Number(o.subtotal || 0),
          Number(o.shippingFee || 0),
          Number(o.totalAmount || 0),
          String(o.orderStatus || ''),
          o.stockDeducted ? 'Yes' : 'No',
          String(o.createdAtLabel || ''),
        ]),
      ];

      const paymentRows = [
        ['Tracking Code', 'Customer Name', 'Payment Method', 'Reference Number', 'Sender Number', 'Payment Status', 'Total Amount (PHP)', 'Order Status'],
        ...orders.map((o: Record<string, unknown>) => [
          String(o.trackingCode || ''),
          String(o.customerName || ''),
          String(o.paymentMethod || ''),
          String(o.paymentReference || 'N/A'),
          String(o.paymentSenderNumber || 'N/A'),
          String(o.paymentStatus || ''),
          Number(o.totalAmount || 0),
          String(o.orderStatus || ''),
        ]),
      ];

      const summaryRows = [
        ['Store Name', "RYAN'S SHOES COLLECTION"],
        ['Backup Timestamp', new Date().toISOString()],
        ['Total Revenue (PHP)', Number(summary.totalRevenue || 0)],
        ['Total Orders', Number(summary.totalOrders || 0)],
        ['Pending Orders', Number(summary.pendingOrders || 0)],
        ['Completed Orders', Number(summary.completedOrders || 0)],
        ['Total Inventory Units', Number(summary.totalUnits || 0)],
        ['Low Stock SKUs', Number(summary.lowStockCount || 0)],
      ];

      // Clear & write each tab
      const tabPayloads: Array<{ range: string; values: unknown[][] }> = [
        { range: 'Products_Inventory!A1', values: productRows },
        { range: 'Orders_Backup!A1', values: orderRows },
        { range: 'Payments_Ledger!A1', values: paymentRows },
        { range: 'Sales_Summary!A1', values: summaryRows },
      ];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ranges: requiredTabs.map((t) => `${t}!A1:Z5000`),
          }),
        }
      );

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: tabPayloads,
          }),
        }
      );

      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        res.status(updateRes.status).json({ error: updateData?.error?.message || 'Failed to write backup rows to Google Sheets.' });
        return;
      }

      res.json({
        success: true,
        spreadsheetId,
        spreadsheetTitle: metaData?.properties?.title || 'Store Backup',
        syncedTabs: requiredTabs,
        updatedCells: updateData?.totalUpdatedCells || 0,
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Google Sheets sync failed.' });
    }
  });

  // Dev Vite middleware or Production static assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RYAN'S SHOES COLLECTION server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
