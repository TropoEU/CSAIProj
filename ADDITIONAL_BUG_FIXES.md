# Additional Bug Fixes - December 10, 2025 (Second Round)

**Status**: 🔄 In Progress
**Bugs Reported**: 4
**Bugs Fixed**: 2
**Bugs Remaining**: 2

---

## Issues Reported

### 1. ✅ Client Detail - Enabled Tools Actions

**Problem**:
- Disable button doesn't work
- Missing Edit and Delete functionality
- Only shows Remove button with no way to edit webhook URL

**Root Cause**:
- Backend route expected `tool_id` but received `client_tools.id` (junction table ID)
- Missing Edit modal and handlers in frontend

**Solution**:
- **Backend**: Added `ClientTool.deleteById(id)` method to delete by junction table ID
- **Backend**: Updated route to use `deleteById()` instead of `delete()`
- **Frontend**: Added Edit button and modal for updating webhook URL
- **Frontend**: Changed "Disable" to "Remove" for clarity
- **Frontend**: Added Edit/Delete actions to client tools table

**Files Modified**:
- `backend/src/models/ClientTool.js` - Added `deleteById()` method
- `backend/src/routes/admin.js` - Updated DELETE route to use `deleteById()`
- `frontend/admin/src/pages/ClientDetail.jsx` - Added Edit modal and handlers
- `frontend/admin/src/services/api.js` - Added global tool management methods

---

### 2. ✅ Tools Page - Missing Management Features

**Problem**:
- Only Test action available
- No Edit or Delete for global tools
- Parameters show only count (e.g., "3 params") without details

**Root Cause**:
- Missing PUT and DELETE routes for global tools
- Missing Edit modal in frontend
- Parameter display shows only `Object.keys(parameters_schema.properties).length`

**Solution**:
**Backend**:
- Added `PUT /admin/tools/:id` route for updating tools
- Added `DELETE /admin/tools/:id` route (prevents deletion if tool is in use)
- Updated `Tool.update()` to allow `tool_name` updates

**Frontend** (IN PROGRESS):
- Need to add Edit modal for tools
- Need to add Delete handler with confirmation
- Need to improve parameter display to show actual parameter names

**Files Modified**:
- ✅ `backend/src/routes/admin.js` - Added PUT and DELETE routes
- ✅ `backend/src/models/Tool.js` - Updated allowed fields to include `tool_name`
- ✅ `frontend/admin/src/services/api.js` - Added create, update, delete methods
- 🔄 `frontend/admin/src/pages/Tools.jsx` - Needs Edit/Delete UI (IN PROGRESS)

---

### 3. ⏸️ Billing Page - Cancel Invoice Action

**Problem**:
- Pending invoices have Cancel button
- Clicking Cancel shows confirmation but doesn't do anything after confirmation

**Status**: NOT STARTED

**Investigation Needed**:
- Check if backend route exists for `POST /admin/billing/invoices/:id/cancel`
- Check if `billing.cancelInvoice()` API method is implemented
- Add proper handler in Billing.jsx

---

### 4. ⏸️ Integrations Page - Missing Activate/Deactivate

**Problem**:
- Only Test, Edit, Delete actions available
- Some integrations show as "inactive" in status but no way to activate
- Missing toggle to enable/disable integrations

**Status**: NOT STARTED

**Solution Needed**:
- Add Activate/Deactivate toggle button
- Update integration status via API
- Show proper visual feedback

---

## Completed Work Summary

### Backend Changes ✅

1. **ClientTool Model** - Added `deleteById()` method
2. **Tool Model** - Updated `update()` to allow `tool_name` changes
3. **Admin Routes** - Added:
   - PUT `/admin/tools/:id` - Update global tool
   - DELETE `/admin/tools/:id` - Delete global tool (with usage check)
   - Fixed DELETE `/admin/clients/:clientId/tools/:id` - Now uses `deleteById()`

### Frontend Changes ✅

1. **API Client** - Added global tool management methods:
   - `tools.create(data)`
   - `tools.update(id, data)`
   - `tools.delete(id)`
   - `tools.getById(id)`

2. **ClientDetail Page** - Added:
   - Edit Tool modal with webhook URL update
   - Edit and Remove buttons in Actions column
   - Proper handlers for editing and removing tools

---

## Work Remaining

### Tools.jsx Frontend Updates 🔄

**Need to add**:
1. Edit modal for global tools
2. Edit form with handlers
3. Delete confirmation and handler
4. Better parameter display showing actual param names

**Implementation**:
```jsx
// Add edit modal state and form
const [isEditModalOpen, setIsEditModalOpen] = useState(false);
const [editingTool, setEditingTool] = useState(null);
const editForm = useForm();

// Add handlers
const handleEdit = (tool) => {
  setEditingTool(tool);
  editForm.reset({
    toolName: tool.tool_name,
    description: tool.description,
    parametersSchema: JSON.stringify(tool.parameters_schema, null, 2)
  });
  setIsEditModalOpen(true);
};

const handleUpdate = async (data) => {
  try {
    await toolsApi.update(editingTool.id, {
      toolName: data.toolName,
      description: data.description,
      parametersSchema: JSON.parse(data.parametersSchema)
    });
    setIsEditModalOpen(false);
    fetchData();
  } catch (err) {
    setError(err.response?.data?.error || 'Failed to update tool');
  }
};

const handleDelete = async (toolId) => {
  if (!confirm('Delete this tool? This cannot be undone.')) return;
  try {
    await toolsApi.delete(toolId);
    fetchData();
  } catch (err) {
    setError(err.response?.data?.error || 'Failed to delete tool');
  }
};

// Update Actions column
<TableCell>
  <div className="flex gap-2">
    <Button variant="ghost" size="sm" onClick={() => openTestModal(tool)}>
      Test
    </Button>
    <Button variant="ghost" size="sm" onClick={() => handleEdit(tool)}>
      Edit
    </Button>
    <Button
      variant="ghost"
      size="sm"
      className="text-red-600"
      onClick={() => handleDelete(tool.id)}
    >
      Delete
    </Button>
  </div>
</TableCell>

// Update Parameters display
<TableCell>
  {tool.parameters_schema?.properties ? (
    <div className="flex flex-wrap gap-1">
      {Object.keys(tool.parameters_schema.properties).map(param => (
        <code key={param} className="text-xs bg-gray-100 px-2 py-1 rounded">
          {param}
        </code>
      ))}
    </div>
  ) : (
    <span className="text-gray-400">No parameters</span>
  )}
</TableCell>
```

### Billing Page - Cancel Invoice 🔄

**Need to check**:
1. Does backend route exist?
2. Is API method implemented?
3. Add handler in Billing.jsx

### Integrations Page - Activate/Deactivate 🔄

**Need to add**:
1. Toggle button in Actions column
2. Handler to update integration status
3. Visual feedback for status changes

---

## Testing Checklist

### Completed ✅
- [x] Client Detail - Remove tool button works
- [x] Client Detail - Edit tool modal opens and updates webhook
- [x] Backend routes for global tool management exist

### Pending ⏸️
- [ ] Tools page - Edit global tool
- [ ] Tools page - Delete global tool
- [ ] Tools page - Parameter details show correctly
- [ ] Billing page - Cancel invoice works
- [ ] Integrations page - Activate/Deactivate works

---

## Next Steps

1. Complete Tools.jsx frontend updates (Edit/Delete/Parameters)
2. Fix Billing page Cancel action
3. Add Integrations Activate/Deactivate
4. Test all fixes
5. Update main BUG_FIXES_SUMMARY.md

---

**Current Session**: In progress - 2 of 4 bugs fixed
