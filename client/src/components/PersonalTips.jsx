import { useState } from 'react';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { timeAgo } from '../utils/format';
import { Avatar } from './ui';
import Icon from './Icon';

// Private tips the member's organisation wrote just for them. Shown only when there are any.
export default function PersonalTips() {
  const toast = useToast();
  const tips = useApi('/personal-tips', [], { refreshMs: 15000 });
  const [openId, setOpenId] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const list = tips.data?.tips || [];
  if (!list.length) return null;

  const send = async (e, tip) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const r = await api.post(`/personal-tips/${tip._id}/replies`, { content: reply });
      tips.setData((d) => ({ tips: d.tips.map((t) => (t._id === tip._id ? r.tip : t)) }));
      setReply('');
      setOpenId(null);
      toast('Reply sent');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack" id="personal-tips" style={{ gap: 14 }}>
      <div>
        <h2>Tips from your organisation</h2>
        <p className="small muted">Written just for you. Only you can see them.</p>
      </div>
      {list.map((t) => (
        <div key={t._id} className="thread">
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <Avatar user={{ name: t.from?.name, avatarUrl: t.from?.avatarUrl, role: 'business' }} size="sm" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="small"><strong>{t.from?.name || 'Your organisation'}</strong> <span className="muted">· {timeAgo(t.createdAt)}</span></div>
              <p style={{ overflowWrap: 'anywhere' }}>{t.content}</p>
            </div>
          </div>
          {t.replies.map((r) => (
            <div key={r._id} className={`bubble ${r.mine ? 'mine' : ''}`}>
              <div className="small"><strong>{r.mine ? 'You' : r.author.name}</strong> <span className="muted">· {timeAgo(r.createdAt)}</span></div>
              <p style={{ overflowWrap: 'anywhere' }}>{r.content}</p>
            </div>
          ))}
          {openId === t._id ? (
            <form className="reply-form" onSubmit={(e) => send(e, t)}>
              <input id={`ptip-reply-${t._id}`} aria-label="Reply to this tip" maxLength={1000} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} autoFocus />
              <button className="btn btn-sm" disabled={busy || !reply.trim()}>Send</button>
            </form>
          ) : (
            <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => { setOpenId(t._id); setReply(''); }}><Icon name="message" size={14} />Reply</button>
          )}
        </div>
      ))}
    </div>
  );
}
