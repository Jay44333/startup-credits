from pathlib import Path

p = Path("src/Mod/Part/Gui/ViewProviderMirror.cpp")
s = p.read_bytes()
nl = b"\r\n" if b"\r\n" in s else b"\n"

def lines(text: str) -> bytes:
    return text.replace("\n", nl.decode()).encode()

def replace_once(old: str, new: str) -> None:
    global s
    old_b = lines(old)
    new_b = lines(new)
    assert old_b in s, old
    s = s.replace(old_b, new_b, 1)

replace_once(
    "#include <Gui/Control.h>\n#include <Gui/Document.h>\n",
    "#include <Gui/Control.h>\n#include <Gui/Document.h>\n#include <Gui/TaskView/TaskDialog.h>\n",
)

replace_once(
    "using namespace PartGui;\n\nPROPERTY_SOURCE(PartGui::ViewProviderMirror, PartGui::ViewProviderPart)\n",
    "using namespace PartGui;\n\n"
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
    "}  // namespace\n\n"
    "PROPERTY_SOURCE(PartGui::ViewProviderMirror, PartGui::ViewProviderPart)\n",
)

replace_once(
    "bool ViewProviderMirror::setEdit(int ModNum)\n"
    "{\n"
    "    if (ModNum == ViewProvider::Default) {\n"
    "        // get the properties from the mirror feature\n",
    "bool ViewProviderMirror::setEdit(int ModNum)\n"
    "{\n"
    "    if (ModNum == ViewProvider::Default) {\n"
    "        if (Gui::Control().activeDialog(getDocument()->getDocument())) {\n"
    "            return false;\n"
    "        }\n\n"
    "        // get the properties from the mirror feature\n",
)

replace_once(
    "        pcRoot->addChild(pcEditNode);\n"
    "    }\n"
    "    else {\n",
    "        pcRoot->addChild(pcEditNode);\n"
    "        Gui::Control().showDialog(new TaskMirrorPlane(getDocument()), getDocument()->getDocument());\n"
    "    }\n"
    "    else {\n",
)

replace_once(
    "        pcRoot->removeChild(pcEditNode);\n"
    "        Gui::coinRemoveAllChildren(pcEditNode);\n"
    "    }\n"
    "    else {\n",
    "        pcRoot->removeChild(pcEditNode);\n"
    "        Gui::coinRemoveAllChildren(pcEditNode);\n"
    "        Gui::Control().closeDialog(getDocument()->getDocument());\n"
    "    }\n"
    "    else {\n",
)

p.write_bytes(s)
