# Accept a fully evidence-verified 9-player order, or a strictly valid
# 1-1-1 DEADLOCK. Never treat a deadlock as a selected lineup.
# The roster file contains one array of the 14 CURRENT players.
.mode == "FULL_LINEUP"
and (.personaLineups | type == "object")
and ((.personaLineups | keys | sort) == ["balthasar","casper","melchior"])
and ([.personaLineups[] | (length == 9 and (unique | length) == 9)] | all)
and ([.personaLineups[][] as $p | ($roster[0] | index($p)) != null] | all)
and ((.crossDiscussion.challenges.melchior | length) > 0)
and ((.crossDiscussion.challenges.balthasar | length) > 0)
and ((.crossDiscussion.challenges.casper | length) > 0)
and (
  if .status == "LINEUP_RESULT" then
    ((.deliberationDecision == "CONSENSUS" and .finalVote == "3-0")
       or (.deliberationDecision == "MAJORITY" and .finalVote == "2-1"))
    and ((.lineup | length) == 9)
    and ((.lineup | map(.name) | unique | length) == 9)
    and ([.lineup[].name as $p | ($roster[0] | index($p)) != null] | all)
    and (.fieldingStatus == "COMPLETE")
    and ((.lineup | map(.position) | unique | length) == 9)
    and ((.lineup | map(.position) | sort) == (["一","三","中","二","右","左","投","捕","遊"] | sort))
    and ([.lineup[].positionEvidence
          | ([.officialStarts,.practiceFirstStarts,.totalStarts,.recentStarts,.fieldingAppearances] | any(. > 0))] | all)
  elif .status == "LINEUP_REVIEW_REQUIRED" then
    .reviewReason == "FULL_LINEUP_DEADLOCK_1_1_1"
    and .deliberationDecision == "DEADLOCK"
    and .finalVote == "1-1-1"
    and (.lineup | length) == 0
    and (.battingOrder | length) == 0
    and .fieldingStatus == "NOT_EVALUATED"
    and .fieldingReason == "LINEUP_DEADLOCK"
    and ((.proposalGroups | length) == 3)
    and ((.slotConflicts | length) > 0)
    and (([.personaLineups[] | join(">")] | unique | length) == 3)
  else false end
)
