import { useState } from 'react';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { Avatar, Co2, Empty, ErrorMsg, PageHeader, Spinner } from '../components/ui';
import { LEVEL, timeAgo } from '../utils/format';
import Icon from '../components/Icon';
import { TextField } from '../components/FormFields';
import { minLen } from '../utils/validation';

// One message in a personal-tip thread
function Bubble({ author, content, createdAt, mine }) {
  return (
    <div className={`bubble ${mine ? 'mine' : ''}`}>
      <div className="small"><strong>{author}</strong> <span className="muted">· {timeAgo(createdAt)}</span></div>
      <p style={{ overflowWrap: 'anywhere' }}>{content}</p>
    </div>
  );
}

// Private tips to one member. Only that member sees them, and they can reply.
function TipThread({ member, onClose, onSent }) {
  const toast = useToast();
  const thread = useApi(`/business/members/${member.userId}/tips`, [member.userId], { refreshMs: 10000 });
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverErr, setServerErr] = useState('');
  const textErr = serverErr || (touched ? minLen(text, 5, 'the tip') : null);

  const send = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (minLen(text, 5, 'the tip')) return;
    setBusy(true);
    try {
      const r = await api.post(`/business/members/${member.userId}/tips`, { content: text });
      thread.setData((d) => ({ tips: [r.tip, ...(d?.tips || [])] }));
      setText('');
      setTouched(false);
      toast(`Tip sent to ${member.name}`);
      onSent();
    } catch (err) {
      setServerErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e, tip) => {
    e.preventDefault();
    if (!reply.trim()) return;
    try {
      const r = await api.post(`/business/tips/${tip._id}/replies`, { content: reply });
      thread.setData((d) => ({ tips: d.tips.map((t) => (t._id === tip._id ? r.tip : t)) }));
      setReply('');
      setReplyTo(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (tip) => {
    try {
      await api.del(`/business/tips/${tip._id}`);
      thread.setData((d) => ({ tips: d.tips.filter((t) => t._id !== tip._id) }));
      onSent();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const tips = thread.data?.tips || [];
  return (
    <div className="card stack" id="tip-thread" style={{ gap: 14 }}>
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Avatar user={member} />
          <div><h2>Personal tips for {member.name}</h2><p className="small muted">Only {member.name} can see these, and they can reply.</p></div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x" size={15} />Close</button>
      </div>
      <form className="form" onSubmit={send} noValidate>
        <TextField id="ptip-text" label="Your tip" multiline counter maxLength={1000} value={text} onChange={(v) => { setText(v); setTouched(true); setServerErr(''); }} error={textErr}
          placeholder={member.footprint ? 'e.g. Your transport is the largest part of your footprint. Try the company shuttle twice a week.' : 'e.g. Try logging your commute this week so we can suggest the best change.'} />
        <div className="row" style={{ justifyContent: 'flex-end' }}><button id="ptip-send" className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send tip'}</button></div>
      </form>
      <ErrorMsg message={thread.error} onRetry={thread.reload} />
      {thread.loading && !thread.data ? <Spinner /> : tips.length === 0 ? (
        <p className="small muted">No tips sent to {member.name} yet.</p>
      ) : tips.map((t) => (
        <div key={t._id} className="thread">
          <Bubble author="You" content={t.content} createdAt={t.createdAt} mine />
          {t.replies.map((r) => <Bubble key={r._id} author={r.mine ? 'You' : r.author.name} content={r.content} createdAt={r.createdAt} mine={r.mine} />)}
          {replyTo === t._id ? (
            <form className="reply-form" onSubmit={(e) => sendReply(e, t)}>
              <input aria-label="Write a reply" maxLength={1000} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} autoFocus />
              <button className="btn btn-sm" disabled={!reply.trim()}>Reply</button>
            </form>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <button className="link-btn small" onClick={() => { setReplyTo(t._id); setReply(''); }}>Reply</button>
              <button className="link-btn small" style={{ color: 'var(--carbon)' }} onClick={() => remove(t)}>Delete</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function BusinessMembers() {
  const toast = useToast();
  const m = useApi('/business/members', [], { refreshMs: 15000 });
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const rows = m.data?.members || [];

  const removeMember = async (r) => {
    try {
      const res = await api.del(`/business/members/${r.userId}`);
      toast(res.message);
      setConfirm(null);
      if (selected?.userId === r.userId) setSelected(null);
      m.setData((d) => ({ ...d, members: d.members.filter((x) => x.userId !== r.userId) }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="stack">
      <PageHeader title="Members" subtitle="Everyone in your communities, updated live. Footprints show only for members who allow sharing." />
      <ErrorMsg message={m.error} onRetry={m.reload} />
      {selected && <TipThread member={selected} onClose={() => setSelected(null)} onSent={m.refresh} />}
      <div className="card">
        {m.loading && !m.data ? <Spinner /> : rows.length === 0 ? (
          <Empty icon="users" title="No members yet">Create a community on the Communities page, then share its invitation code.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Member</th><th>Communities</th><th className="num">Transport</th><th className="num">Energy</th><th className="num">Waste</th><th className="num">Total CO₂ (30d)</th><th>Level</th><th className="num">Goals ✓</th><th className="num">Points</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className={selected?.userId === r.userId ? 'me-row' : ''}>
                    <td><div className="row" style={{ flexWrap: 'nowrap' }}><Avatar user={r} size="sm" /><span style={{ whiteSpace: 'nowrap' }}>{r.name}<div className="small muted">@{r.username}</div></span></div></td>
                    <td className="small">{r.communities.join(', ')}</td>
                    {r.footprint ? (
                      <>
                        <td className="num"><Co2 value={r.footprint.transport} digits={0} /></td>
                        <td className="num"><Co2 value={r.footprint.energy} digits={0} /></td>
                        <td className="num"><Co2 value={r.footprint.waste} digits={0} /></td>
                        <td className="num"><Co2 value={r.footprint.totalKg} digits={0} /></td>
                        <td>{r.footprint.level ? <span className={`pill ${LEVEL[r.footprint.level].cls}`}>{LEVEL[r.footprint.level].short}</span> : <span className="small muted">No data</span>}</td>
                      </>
                    ) : <td colSpan={5} className="small muted">Private: footprint not shared</td>}
                    <td className="num">{r.goalsAchieved}</td>
                    <td className="num">{r.points}</td>
                    <td className="num">
                      {confirm === r.userId ? (
                        <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <button className="btn btn-red btn-sm" onClick={() => removeMember(r)}>Remove</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
                        </span>
                      ) : (
                        <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                            <Icon name="bulb" size={14} />Tip{r.tipCount ? ` (${r.tipCount})` : ''}
                          </button>
                          <button className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirm(r.userId)}>Remove</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
