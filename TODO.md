# Todo

- What to do about duplicate posts?

  - Check the thread for the archivist output on a previous post.
  - If it exists, then check Discourse to see if the post still exists.
  - If it doesn't, create a new one.
  - If it does, report this to the user.

- Incremental update

  - Watch archived conversations, and incrementally update them.

- There is a webhook API in Discourse. So:
  - set up an incoming server on the bot to respond to changes to Discourse (mostly deleting archived posts).
  - configure the webhook in Discourse.
  - delete the database entry when a post is deleted in Discourse.
