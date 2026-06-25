JUDGE_PROMPT = """
You are evaluating an incident response. Score it 1-5 on:
- Relevance: Does the response address the actual symptoms described?
- Actionability: Are the triage steps specific and ordered correctly?
- Accuracy: Does it avoid contradicting the retrieved runbooks?

Incident: {incident}
Retrieved runbooks: {runbooks}
Generated response: {response}

Reply ONLY with JSON: {{"relevance": N, "actionability": N, "accuracy": N, "notes": "..."}}
"""
