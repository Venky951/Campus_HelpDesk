exports.updateStatus = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;

    await Ticket.findByIdAndUpdate(ticketId, {
      status: status,
    });

    res.redirect("/admin");
  } catch (err) {
    console.log(err);
  }
};
