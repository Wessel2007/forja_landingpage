const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const email = (req.body && req.body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: 'invalid_email' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    res.status(500).json({ ok: false, error: 'server_not_configured' });
    return;
  }

  try {
    if (audienceId) {
      const contactRes = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, unsubscribed: false })
      });
      if (!contactRes.ok && contactRes.status !== 409) {
        const detail = await contactRes.text();
        console.error('Resend contact error:', detail);
      }
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: 'Alistamento confirmado — Fornalha',
        html: `
          <div style="font-family:Arial,sans-serif;background:#0D0B09;color:#F4EFE9;padding:32px;">
            <h1 style="color:#FF6B2B;font-size:20px;">Alistamento confirmado.</h1>
            <p style="line-height:1.6;">Você entrou para a lista de fundadores da Fornalha. Assim que o app abrir para download, você será avisado primeiro por este email.</p>
            <p style="color:rgba(244,239,233,.6);font-size:13px;margin-top:24px;">Fornalha — Forge autocontrole.</p>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      const detail = await emailRes.text();
      console.error('Resend email error:', detail);
      res.status(502).json({ ok: false, error: 'email_send_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ ok: false, error: 'unexpected_error' });
  }
};
