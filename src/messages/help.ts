export const helpText = `Hi, I'm the Slack Archivist.

I can send useful conversation threads to the [Camunda forum](https://forum.camunda.io), to capture valuable information. 

When you see a thread worth capturing, tag me with @archivist in a reply to the conversation, and I'll send the thread to the forum, and keep watching it for updates. 
  
If there are no replies (you want to archive a single post) then reply to the OP (your reply creates a thread) and tag me in that reply.

When you tag me, put the text you want as the post title. For example:

@archivist How do I find out what the latest version of X is?

I don't respond to DMs, but you can chat to me in #archivist.

[Read more in the forum](https://forum.camunda.io/t/about-the-knowledge-from-camunda-platform-8-slack-category/36873).

## Commands

**--help**: emit this help message
**--test**: build a post and put it as a reply visible only to you. This is useful for testing.`;

export const notThreadedMessage =
  "Tag me _in a threaded reply_ with what you want as the post title, and I'll put the thread in the Forum for you. If there are no replies, you can reply to the OP (your reply makes a thread) and tag me in that reply.";

export const noTitle =
  "Tag me with what you want as the post title, and I'll put this thread in the Forum for you.\n\nFor example:\n\n@archivist How do I collect the output of a multi-instance sub-process?";
