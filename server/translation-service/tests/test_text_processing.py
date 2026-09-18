from app.text_processing import detect_language, protect_text, restore_placeholders, split_text


def test_detect_direction():
    assert detect_language("用户支付") == ("zh", "en")
    assert detect_language("payment completed") == ("en", "zh")


def test_long_text_chunking_preserves_content():
    text = "第一句。" * 30
    chunks = split_text(text, 20)
    assert len(chunks) > 1
    assert "".join(chunks) == text


def test_code_and_glossary_are_protected():
    protection = protect_text(
        "用户订单列表的 orderStatus 字段为空时显示 EmptyState。",
        "zh",
        glossary={"字段": "field"},
    )
    assert "orderStatus" not in protection.text
    assert "EmptyState" not in protection.text
    assert "字段" not in protection.text
    restored, missing = restore_placeholders(
        protection.text.replace("占位符A", "placeholder A"),
        "zh",
        protection.replacements,
    )
    assert not missing
    assert "orderStatus" in restored
    assert "EmptyState" in restored
    assert "field" in restored
