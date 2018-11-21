module.exports = {
  getEvent(receipt, event, arg, index=0) {
    const events = receipt.events[event]

    if (Array.isArray(events)) {
      event = events[index]
    } else {
      event = events
    }

    return event.returnValues[arg]
  }
}
