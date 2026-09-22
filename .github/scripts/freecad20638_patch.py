from pathlib import Path

p = Path("src/Mod/Part/Gui/ViewProviderMirror.cpp")
s = p.read_bytes()
nl = b"\r\n" if b"\r\n" in s else b"\n"


def insert_after(anchor: bytes, addition_lf: str, occurrence: int = 1) -> None:
    global s
    start = -1
    pos = 0
    for _ in range(occurrence):
        start = s.find(anchor, pos)
        assert start >= 0, anchor
        pos = start + len(anchor)
    s = s[:pos] + addition_lf.encode() + s[pos:]


def insert_before(anchor: bytes, addition_lf: str, occurrence: int = 1) -> None:
    global s
    start = -1
    pos = 0
    for _ in range(occurrence):
        start = s.find(anchor, pos)
        assert start >= 0, anchor
        pos = start + len(anchor)
    s = s[:start] + addition_lf.encode() + s[start:]


insert_after(
    b"#include <Gui/Document.h>" + nl,
    "#include <Gui/TaskView/TaskDialog.h>\n",
)

insert_before(
    b"PROPERTY_SOURCE(PartGui::ViewProviderMirror, PartGui::ViewProviderPart)" + nl,
    "namespace\n"
    "{\n"
    "class TaskMirrorPlane: public Gui::TaskView::TaskDialog\n"
    "{\n"
    "public:\n"
    "    explicit TaskMirrorPlane(Gui::Document* document)\n"
    "        : document(document)\n"
    "    {}\n\n"
    "    bool reject() override\n"
    "    {\n"
    "        if (document) {\n"
    "            document->resetEdit();\n"
    "        }\n"
    "        return false;\n"
    "    }\n\n"
    "    QDialogButtonBox::StandardButtons getStandardButtons() const override\n"
    "    {\n"
    "        return QDialogButtonBox::Close;\n"
    "    }\n\n"
    "private:\n"
    "    Gui::Document* document;\n"
    "};\n"
    "}  // namespace\n\n",
)

set_edit_anchor = (
    b"bool ViewProviderMirror::setEdit(int ModNum)" + nl
    + b"{" + nl
    + b"    if (ModNum == ViewProvider::Default) {" + nl
)
insert_after(
    set_edit_anchor,
    "        if (Gui::Control().activeDialog(getDocument()->getDocument())) {\n"
    "            return false;\n"
    "        }\n\n",
)

insert_after(
    b"        pcRoot->addChild(pcEditNode);" + nl,
    "        Gui::Control().showDialog(new TaskMirrorPlane(getDocument()), getDocument()->getDocument());\n",
)

mirror_unset_anchor = (
    b"        pcRoot->removeChild(pcEditNode);" + nl
    + b"        Gui::coinRemoveAllChildren(pcEditNode);" + nl
)
insert_after(
    mirror_unset_anchor,
    "        Gui::Control().closeDialog(getDocument()->getDocument());\n",
)

p.write_bytes(s)
