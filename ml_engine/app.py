import os
import re

import joblib
from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

vectorizer = joblib.load("vectorizer.pkl")
model = joblib.load("category_model.pkl")
PORT = int(os.getenv("PORT", "5001"))
CONFIDENCE_THRESHOLD = 0.45
FALLBACK_CATEGORY = "Education/Special"
CATEGORY_KEYWORDS = {
    "Utilities": {
        "utility",
        "utilities",
        "utliities",
        "electricity",
        "current bill",
        "water",
        "gas",
        "wifi",
        "internet",
        "broadband",
        "mobile recharge",
        "phone bill",
        "dth",
        "milk",
        "brush",
        "toothbrush",
        "toothpaste",
        "soap",
        "detergent",
        "cleaning",
        "grocery essentials",
        "electricity bill",
        "broadband",
        "internet bill",
        "water bill",
        "gas bill",
    },
    "Transport": {
    "car",
    "transport",
    "transportation",
    "uber",
    "taxi",
    "bus",
    "train",
    "flight",
    "metro",
    "petrol",
    "fuel",
    "cab",
    "rickshaw",
    "auto",
    "ola",
    "rapido",
    "fastag",
    "toll",
    "parking",
    },
    "Food": {
    "meal",
    "meals",
    "measl",
    "lunch",
    "breakfast",
    "dinner",
    "supper",
    "dining",
    "restaurant",
    "food",
    "snacks",
    "ice cream",
    "fast food",
    "drink",
    "juice",
    "tea",
    "coffee",
    "swiggy",
    "zomato",
    "dominos",
    "mcdonalds",
    "kfc",
    "pizza",
    "canteen",
    "cafe",
    "bakery",
    },
    "Shopping": {
        "dress",
        "clothes",
        "clothing",
        "shopping",
        "shirt",
        "tshirt",
        "jeans",
        "pant",
        "pants",
        "shoe",
        "shoes",
        "sneakers",
        "bag",
        "watch",
        "accessories",
        "mall",
        "purchase",
        "buy",
        "bought",
        "amazon",
        "flipkart",
        "myntra",
        "ajio",
    },
    "Education/Special": {
        "education",
        "school",
        "scholl",
        "college",
        "clg",
        "tuition",
        "coaching",
        "books",
        "notebook",
        "exam",
        "fees",
        "fee",
        "hostel",
        "stationery",
    },
    "Entertainment": {
        "entertainment",
        "enetertainment",
        "movie",
        "cinema",
        "park",
        "game",
        "games",
        "gaming",
        "netflix",
        "spotify",
        "concert",
        "show",
        "amusement",
        "netflix",
        "prime video",
        "bookmyshow",
        "pvr",
        "inox",
        "hotstar",
        "youtube premium",
    },
}

RULE_ORDER = ["Food", "Transport", "Shopping", "Entertainment", "Utilities", "Education/Special"]

CATEGORY_PREFIX_PATTERN = re.compile(
    r"^\s*(utilities|transport|food|shopping|education/special|entertainment)\s*:\s*",
    re.IGNORECASE,
)


def normalize_text_for_rules(text):
    normalized = str(text or "").lower().strip()
    normalized = CATEGORY_PREFIX_PATTERN.sub("", normalized)
    return normalized


def has_keyword(text, keywords):
    normalized = normalize_text_for_rules(text)
    for keyword in keywords:
        pattern = r"\b" + re.escape(keyword) + r"\b"
        if re.search(pattern, normalized):
            return True
    return False


def detect_rule_category(text):
    for category in RULE_ORDER:
        if has_keyword(text, CATEGORY_KEYWORDS[category]):
            return category
    return None


@app.route("/api/categorize", methods=["POST"])
def categorize_transactions():
    payload = request.get_json(silent=True) or {}
    transactions = payload.get("transactions")
    description = payload.get("description")
    single_input = False

    # Accept either a single natural-language description string or an array.
    if isinstance(description, str) and description.strip():
        transactions = [description.strip()]
        single_input = True
    elif isinstance(transactions, str) and transactions.strip():
        transactions = [transactions.strip()]
        single_input = True

    if not isinstance(transactions, list) or not transactions:
        return jsonify({"message": "Provide a non-empty description string or transactions array."}), 400

    transformed = vectorizer.transform(transactions)
    predicted_categories = model.predict(transformed)

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(transformed)
        scores = []
        adjusted_categories = []

        for index, row in enumerate(probabilities):
            top_index = row.argmax()
            confidence = float(row[top_index])
            scores.append(confidence)

            predicted_category = str(predicted_categories[index])
            if confidence < CONFIDENCE_THRESHOLD:
                adjusted_categories.append(FALLBACK_CATEGORY)
            else:
                adjusted_categories.append(predicted_category)
    else:
        scores = [1.0] * len(predicted_categories)
        adjusted_categories = [str(category) for category in predicted_categories]

    results = []
    for index, transaction in enumerate(transactions):
        forced_category = detect_rule_category(transaction)
        if forced_category is not None:
            predicted_category = forced_category
            confidence = max(scores[index], 0.99)
        else:
            predicted_category = adjusted_categories[index]
            confidence = scores[index]

        results.append({
            "transaction": transaction,
            "predictedCategory": predicted_category,
            "confidenceScore": confidence,
        })

    if single_input:
        return jsonify({
            "description": results[0]["transaction"],
            "predictedCategory": results[0]["predictedCategory"],
            "confidenceScore": results[0]["confidenceScore"],
        }), 200

    return jsonify({
        "results": results,
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)