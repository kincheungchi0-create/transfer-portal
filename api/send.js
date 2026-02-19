export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, type, content, sessionId, report } = req.body;
  if (!to || (!content && !report)) return res.status(400).json({ error: 'Missing destination or content' });

  const RESEND_API_KEY = 're_4JKPKjBm_CYiwRjXa9sXJkEQj42q9kbyZ';
  const FROM_EMAIL = 'onboarding@resend.dev';
  const SUPABASE_URL = 'https://ifoufoxtbuugsoixaccy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlmb3Vmb3h0YnV1Z3NvaXhhY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NTIzNzAsImV4cCI6MjA4NzAyODM3MH0.EwtRGGrpXFulRKGL1RoHyDJ7RPafIPd-apmezCnVfog';

  // Helper to process base64 for attachments
  const parseBase64 = (dataUrl) => {
    const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return null;
    return { contentType: matches[1], base64: matches[2] };
  };

  try {
    let bodyHtml = '';
    let subject = '';
    let attachments = [];

    if (report) {
      const spRes = await fetch(`${SUPABASE_URL}/rest/v1/transfer_uploads?session_id=eq.${sessionId}&order=created_at.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      
      if (!spRes.ok) throw new Error('Failed to fetch session data from Supabase');
      const items = await spRes.json();
      if (items.length === 0) throw new Error('No items found in this session');

      subject = `HyperTransfer Session Report - ${sessionId}`;
      bodyHtml = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; background: #f9fafb;">
          <h1 style="color: #1d4ed8; margin-bottom: 5px;">HyperTransfer Session Report</h1>
          <p style="color: #6b7280; font-size: 14px; margin-top: 0;">Session ID: <code style="background: #e5e7eb; padding: 2px 4px; border-radius: 4px;">${sessionId}</code></p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <div style="display: flex; flex-direction: column; gap: 30px;">
      `;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const time = new Date(item.created_at).toLocaleString();
        const typeLabel = item.type.toUpperCase();
        
        bodyHtml += `
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <div style="background: #f3f4f6; padding: 10px 15px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold; font-size: 12px; color: #374151;">${typeLabel}</span>
              <span style="font-size: 11px; color: #9ca3af;">${time}</span>
            </div>
            <div style="padding: 20px;">
        `;

        if (item.type === 'image') {
          const parsed = parseBase64(item.content);
          if (parsed) {
            const cid = `img_${i}`;
            attachments.push({
              filename: `image_${i}.png`,
              content: parsed.base64,
              contentId: cid,
              contentType: parsed.contentType
            });
            bodyHtml += `<img src="cid:${cid}" style="max-width: 100%; border-radius: 4px;" />`;
          } else {
            bodyHtml += `<p style="color:red">Invalid image data</p>`;
          }
        } else if (item.type === 'grid') {
          bodyHtml += `<div style="overflow-x: auto; font-size: 12px;">${item.content}</div>`;
        } else {
          bodyHtml += `<pre style="background: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #f3f4f6; white-space: pre-wrap; font-family: monospace; font-size: 13px; color: #1f2937; margin: 0;">${item.content}</pre>`;
        }
        bodyHtml += `</div></div>`;
      }

      bodyHtml += `
          </div>
          <footer style="margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px;">
            Sent by HyperTransfer Portal
          </footer>
        </div>
      `;
    } else {
      const typeLabel = (type || 'Unknown').toUpperCase();
      subject = `HyperTransfer [${typeLabel}] - ${sessionId}`;
      
      let imagePart = '';
      if (type === 'image') {
        const parsed = parseBase64(content);
        if (parsed) {
          const cid = 'single_img';
          attachments.push({
            filename: 'image.png',
            content: parsed.base64,
            contentId: cid,
            contentType: parsed.contentType
          });
          imagePart = `<img src="cid:${cid}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />`;
        } else {
          imagePart = `<p style="color:red">Invalid image data</p>`;
        }
      } else if (type === 'grid') {
        imagePart = `<div style="border: 1px solid #eee; padding: 15px; border-radius: 8px; background: #fff;">${content}</div>`;
      } else {
        imagePart = `<pre style="background:#f8f9fa; padding:20px; border-radius:8px; border:1px solid #e9ecef; white-space: pre-wrap; font-family: monospace;">${content}</pre>`;
      }

      bodyHtml = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>HyperTransfer [${typeLabel}]</h2>
          <p>Session: <b>${sessionId}</b></p>
          <div style="margin-top: 20px;">
            ${imagePart}
          </div>
        </div>
      `;
    }

    const payload = {
      from: `HyperTransfer <${FROM_EMAIL}>`,
      to: [to],
      subject: subject,
      html: bodyHtml
    };
    if (attachments.length > 0) payload.attachments = attachments;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'Resend API error' });

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
