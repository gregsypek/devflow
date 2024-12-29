import { model, models, Schema, Types } from "mongoose";

export interface IInteraction {
  user: Types.ObjectId;
  action: string;
  actionId: Types.ObjectId;
  actionType: "question" | "answer";
}

const InteractionSchema = new Schema<IInteraction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Action: What did they do? Was it an upvote, downvote, view, or maybe posting a new question? This gives us insight into user intent.
    action: {
      type: String,
      required: true,
    },
    // Action ID: What specific content was the action performed on? Was it a question, an answer, or something else?
    actionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    actionType: { type: String, enum: ["question", "answer"], required: true },
  },
  { timestamps: true }
);

const Interaction =
  models?.Interaction || model<IInteraction>("Interaction", InteractionSchema);

export default Interaction;
