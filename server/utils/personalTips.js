const who = (u) => (!u ? 'Deleted user' : u.role === 'business' ? u.companyName || u.name : u.name || u.username);

// Shape a personal tip (populated business and reply authors) for the client
function shapeTip(t, viewerId) {
  return {
    _id: t._id,
    content: t.content,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    from: t.business && t.business._id ? { _id: t.business._id, name: who(t.business), avatarUrl: t.business.avatarUrl || '' } : null,
    replies: (t.replies || []).map((r) => ({
      _id: r._id,
      content: r.content,
      createdAt: r.createdAt,
      author: { _id: r.author?._id, name: who(r.author), avatarUrl: r.author?.avatarUrl || '', isOrganisation: r.author?.role === 'business' },
      mine: String(r.author?._id || r.author) === String(viewerId),
    })),
  };
}

module.exports = { shapeTip };
