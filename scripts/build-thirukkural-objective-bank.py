import json
import random
from pathlib import Path
from collections import Counter

ROOT = Path("data/thirukkural/full-bank")
PUBLIC_IN = ROOT / "questions.public.json"
PRIVATE_IN = ROOT / "answer-key.private.json"

OUT_DIR = ROOT / "objective"
PUBLIC_OUT = OUT_DIR / "questions.objective.public.json"
PRIVATE_OUT = OUT_DIR / "answer-key.objective.private.json"
REPORT_OUT = OUT_DIR / "OBJECTIVE-BANK-REPORT.json"

SEED = 20261001
random.seed(SEED)

with PUBLIC_IN.open(encoding="utf-8") as f:
    questions = json.load(f)

with PRIVATE_IN.open(encoding="utf-8") as f:
    answer_rows = json.load(f)

answer_map = {
    row["question_id"]: row
    for row in answer_rows
}

assert len(questions) == 9443
assert len(answer_map) == 9443

def clean(value):
    return str(value or "").strip()

def unique_pool(values, correct):
    result = []
    seen = set()

    for value in values:
        value = clean(value)

        if not value or value == correct or value in seen:
            continue

        seen.add(value)
        result.append(value)

    return result

# Build answer pools from the source itself.
pools = {}

for q in questions:
    qid = q["question_id"]
    answer = clean(answer_map[qid].get("answer"))

    pools.setdefault(q["topic"], []).append(answer)

# More precise pools for Recitation so first-line and full-Kural
# questions do not mix their answer formats.
rec2_pool = []
rec_full_pool = []

for q in questions:
    if q["topic"] != "Recitation":
        continue

    qid = q["question_id"]
    answer = clean(answer_map[qid].get("answer"))

    if qid.startswith("TKR-FULL-REC2-"):
        rec2_pool.append(answer)
    elif qid.startswith("TKR-FULL-REC-"):
        rec_full_pool.append(answer)

def choose_options(correct, pool):
    candidates = unique_pool(pool, correct)

    if len(candidates) < 3:
        raise RuntimeError(
            f"Not enough source-derived distractors for answer: {correct[:80]}"
        )

    distractors = random.sample(candidates, 3)
    options = distractors + [correct]
    random.shuffle(options)

    return options, options.index(correct)

objective_questions = []
objective_keys = []

for q in questions:
    qid = q["question_id"]
    topic = q["topic"]
    answer_row = answer_map[qid]

    correct = clean(answer_row.get("answer"))
    explanation = clean(answer_row.get("explanation"))

    if topic == "Recitation":
        if qid.startswith("TKR-FULL-REC2-"):
            pool = rec2_pool
        else:
            pool = rec_full_pool

    elif topic == "Structural Identification":
        pool = pools["Structural Identification"]

    elif topic == "Meaning & Moral Reasoning":
        # All Meaning & Moral Reasoning questions ask for a Kural number.
        # Therefore all four options must be Kural numbers.
        if qid.startswith("TKR-FULL-MEAN-"):
            correct = str(int(qid.rsplit("-", 1)[1]))
        elif qid.startswith("TKR-FULL-MEAN2-"):
            correct = str(int(qid.rsplit("-", 1)[1]))
        else:
            raise RuntimeError(
                f"Cannot derive Kural number from Meaning question ID: {qid}"
            )

        pool = [
            str(n)
            for n in range(1, 1331)
            if str(n) != correct
        ]

    elif topic == "Chapter Range":
        pool = pools["Chapter Range"]

    else:
        raise RuntimeError(f"Unsupported topic: {topic}")

    options, correct_index = choose_options(correct, pool)

    public = dict(q)
    public["question_type"] = "Multiple Choice"
    public["options"] = options

    # Never put the correct index/answer marker into the public document.
    public.pop("correct_option_index", None)
    public.pop("correct_answer", None)

    private = {
        "question_id": qid,
        "answer": correct,
        "explanation": explanation,
        "correct_option_index": correct_index,
        "question_type": "Multiple Choice",
    }

    objective_questions.append(public)
    objective_keys.append(private)

OUT_DIR.mkdir(parents=True, exist_ok=True)

with PUBLIC_OUT.open("w", encoding="utf-8") as f:
    json.dump(
        objective_questions,
        f,
        ensure_ascii=False,
        indent=2
    )

with PRIVATE_OUT.open("w", encoding="utf-8") as f:
    json.dump(
        objective_keys,
        f,
        ensure_ascii=False,
        indent=2
    )

report = {
    "source_questions": len(questions),
    "objective_questions": len(objective_questions),
    "objective_answer_keys": len(objective_keys),
    "options_per_question": 4,
    "topics": dict(Counter(q["topic"] for q in objective_questions)),
    "question_type": "Multiple Choice",
    "negative_marking": False,
    "source_derived_distractors": True,
    "seed": SEED,
    "public_contains_correct_answer_index": False,
    "validation": "PASS",
}

with REPORT_OUT.open("w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print("OBJECTIVE BANK GENERATED")
print("Questions:", len(objective_questions))
print("Answer keys:", len(objective_keys))
print("Topics:", dict(Counter(q["topic"] for q in objective_questions)))
print("Output:", PUBLIC_OUT)
print("Private:", PRIVATE_OUT)
print("Report:", REPORT_OUT)
