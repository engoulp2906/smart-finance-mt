from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "dataset.csv"
VECTORIZER_PATH = BASE_DIR / "vectorizer.pkl"
MODEL_PATH = BASE_DIR / "category_model.pkl"


def load_dataset(dataset_path=DATASET_PATH):
    data = pd.read_csv(dataset_path)

    required_columns = {"description", "category"}
    missing = required_columns.difference(data.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {sorted(missing)}")

    data = data.copy()
    data["description"] = data["description"].fillna("").astype(str).str.strip()
    data["category"] = data["category"].fillna("").astype(str).str.strip()

    data = data[(data["description"] != "") & (data["category"] != "")]
    data = data.drop_duplicates(subset=["description", "category"]).reset_index(drop=True)

    if data.empty:
        raise ValueError("Dataset has no valid rows after cleaning.")

    return data


def train_and_save_models():
    data = load_dataset()

    label_counts = data["category"].value_counts()
    valid_labels = label_counts[label_counts >= 2].index
    dropped_rows = data[~data["category"].isin(valid_labels)]
    if not dropped_rows.empty:
        print("Dropping labels with <2 rows (cannot stratify reliably):")
        print(dropped_rows["category"].value_counts().to_string())
    data = data[data["category"].isin(valid_labels)].copy()

    x_train, x_test, y_train, y_test = train_test_split(
        data["description"],
        data["category"],
        test_size=0.2,
        random_state=42,
        stratify=data["category"],
    )

    vectorizer = TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
        sublinear_tf=True,
    )
    x_train_vec = vectorizer.fit_transform(x_train)
    x_test_vec = vectorizer.transform(x_test)

    classifier = LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        solver="lbfgs",
        random_state=42,
    )
    classifier.fit(x_train_vec, y_train)

    y_pred = classifier.predict(x_test_vec)
    print("\nValidation report:\n")
    print(classification_report(y_test, y_pred, zero_division=0))

    joblib.dump(vectorizer, VECTORIZER_PATH)
    joblib.dump(classifier, MODEL_PATH)

    print(f"Saved vectorizer: {VECTORIZER_PATH}")
    print(f"Saved model: {MODEL_PATH}")
    print(f"Trained on {len(data)} rows across {data['category'].nunique()} categories.")


if __name__ == "__main__":
    train_and_save_models()