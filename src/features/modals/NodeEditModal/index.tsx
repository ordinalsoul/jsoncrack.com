import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, TextInput, Textarea, Button } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";
import { contentToJson, jsonToContent } from "../../../lib/utils/jsonAdapter";
import { useModal } from "../../../store/useModal";

export const NodeEditModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const format = useFile(state => state.format);
  const contents = useFile(state => state.contents);

  const setVisible = useModal(state => state.setVisible);

  const [editedValues, setEditedValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const initial: Record<string, string> = {};
    if (nodeData) {
      nodeData.text.forEach((row, idx) => {
        if (row.type === "object" || row.type === "array") return;
        const key = row.key ?? String(idx);
        initial[key] = String(row.value ?? "");
      });
    }
    setEditedValues(initial);
  }, [nodeData]);

  const handleInputChange = (key: string | null, v: string) => {
    const id = key ?? "__root";
    setEditedValues(prev => ({ ...prev, [id]: v }));
  };

  const doSave = async () => {
    if (!nodeData) return;
    try {
      const root = (await contentToJson(contents, format)) as any;
      const path = nodeData.path ?? [];

      let target = root;
      if (path.length > 0) {
        for (const seg of path) target = target?.[seg as any];
      }

      for (const rawKey of Object.keys(editedValues)) {
        const isRoot = rawKey === "__root";
        const val = editedValues[rawKey];

        const row = nodeData.text.find((r, idx) => (r.key ?? String(idx)) === (isRoot ? null : rawKey));
        const rowType = row?.type;

        let newSub: any = val;
        if (rowType === "number" || rowType === "boolean" || val === "null") {
          try {
            newSub = JSON.parse(val);
          } catch {
            newSub = val;
          }
        }

        if (isRoot) {
          if (path.length === 0) {
            const newContent = await jsonToContent(JSON.stringify(newSub), format);
            await useFile.getState().setContents({ contents: newContent });
          } else {
            let cursor = root;
            for (let i = 0; i < path.length - 1; i++) cursor = cursor[path[i] as any];
            cursor[path[path.length - 1] as any] = newSub;
            const newContent = await jsonToContent(JSON.stringify(root), format);
            await useFile.getState().setContents({ contents: newContent });
          }
        } else {
          if (target && typeof target === "object") {
            target[rawKey as any] = newSub;
          }
        }
      }

      if (Object.keys(editedValues).some(k => k !== "__root")) {
        const newContent = await jsonToContent(JSON.stringify(root), format);
        await useFile.getState().setContents({ contents: newContent });
      }

      try {
        const latest = useFile.getState().contents;
        const parsed = await contentToJson(latest, format);
        useJson.getState().setJson(JSON.stringify(parsed, null, 2));
      } catch (e) {}

      setVisible("NodeEditModal", false);
      setVisible("NodeModal", true);
    } catch (err) {
      console.warn("Failed to save edited node values", err);
    }
  };

  const onCancel = () => {
    setVisible("NodeEditModal", false);
    setVisible("NodeModal", true);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onCancel} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Edit Content
            </Text>
            <CloseButton onClick={onCancel} />
          </Flex>

          <ScrollArea.Autosize mah={250} maw={600}>
            <Stack gap="xs">
              {nodeData && nodeData.text.length > 0 ? (
                nodeData.text.map((row, idx) => {
                  if (row.type === "object" || row.type === "array") {
                    return (
                      <Text key={idx} fz="xs" c="dimmed">
                        {row.key ? `${row.key}: ${row.type === "object" ? `{${row.childrenCount} keys}` : `[${row.childrenCount} items]`}` : `${row.type}`}
                      </Text>
                    );
                  }

                  const key = row.key ?? null;
                  const id = key ?? String(idx);
                  const v = editedValues[id] ?? String(row.value ?? "");

                  if (key === null && nodeData.text.length === 1) {
                    return (
                      <Textarea
                        key={id}
                        minRows={3}
                        label="Value"
                        value={v}
                        onChange={e => handleInputChange(null, e.currentTarget.value)}
                        styles={{ input: { fontFamily: "monospace" } }}
                      />
                    );
                  }

                  return (
                    <TextInput
                      key={id}
                      label={key ?? `item ${idx}`}
                      value={v}
                      onChange={e => handleInputChange(key, e.currentTarget.value)}
                    />
                  );
                })
              ) : (
                <Text fz="xs" c="dimmed">
                  No editable content
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Stack>
        <Flex justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={doSave}>
            Save
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
};

export default NodeEditModal;
