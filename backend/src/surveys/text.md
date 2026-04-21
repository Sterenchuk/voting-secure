  1. The Big Box (Nested Storage)
  Imagine you have a Giant Box (the Survey).
  Inside that box, you have Middle-Sized Boxes (the Questions).
  And inside those, you have Little Tiny Boxes (the Options, like "Yes" or "No").

  When you want to build a survey, you don't put them in one by one. You build the whole thing—boxes inside boxes—and throw it into the "Database" (the Attic) all at once. This makes sure no
  questions or options get lost or mixed up.

  2. The Sticker (The Ballot Hash)
  This is the most important part. When you pick an answer, your computer makes a Magic Sticker (the Ballot Hash). 
   * How it's made: Your computer takes your answer and some random noise and mashes them together into a long string of gibberish.
   * Why it protects you: Even if someone finds your answer, they only see the gibberish sticker. Only you know that sticker is yours. The computer that stores the data never sees your name; it
     only sees the sticker.

  3. The "No-Clock" Rule (Timing Protection)
  In the Attic (Database), we have two piles:
   * Pile A: A list of kids who came into the room (Users who participated).
   * Pile B: A pile of answers with Magic Stickers on them.

  There is NO line connecting Pile A and Pile B. 
  Also, we threw away the clock. Most computers write down exactly when you did something (like 10:01:05 AM). We don't. Because if the teacher saw you walked in at 10:01 and an answer appeared at
  10:01, they'd know it was you. By throwing away the clock, we make it fucking impossible to match the person to the answer.

  4. How we get the Score (getResults)
  We use two things: a Fast Whiteboard (Redis) and the Attic (Database).

   * The Fast Whiteboard (Redis): Every time a kid puts an answer in the box, we quickly add a mark on a whiteboard. This is super fast. When someone asks "Who is winning?", we just look at the
     whiteboard and yell the answer.
   * The Attic (Database): This is for when the whiteboard gets erased. We go to the Attic, count all the papers with the Magic Stickers one by one, and put the score back on the whiteboard.

  5. Summary for your 5-year-old brain:
   1. Boxes inside Boxes: Keep everything together.
   2. Magic Stickers: Hide your name so nobody can find you.
   3. No Clocks: Prevents people from "guessing" who you are based on when you voted.
   4. Whiteboard vs. Attic: The whiteboard is for speed; the attic is for safety. 

  This is how we follow the EU Recommendation. We make sure the system knows you voted, and the system knows what was voted for, but it never knows what you specifically chose. Fucking magic.