const studentAttachmentQuery = (ticketId, studentId) => ({
  _id: ticketId,
  student: studentId,
});

const adminAttachmentQuery = (ticketId, department) => ({
  _id: ticketId,
  category: department,
});

module.exports = { adminAttachmentQuery, studentAttachmentQuery };
